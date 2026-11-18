import { afterAll, beforeAll, expect, it } from "vitest";

import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  takeOnlyRow,
  type Database,
  type Session,
  type TestUser,
  type UserRole,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

const ANONYMOUS: Session = { kind: "anonymous" };
const SERVICE: Session = { kind: "service" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
const APPEND_ONLY = /solo inserción/i;
// Las entradas de prueba llevan esta acción. La tabla no se puede limpiar
// (es de solo inserción), así que cada prueba busca por su propio id.
const TEST_ACTION = "prueba.integracion";

let database: Database;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

/** Inserta una entrada como lo hace el servidor y devuelve su id. */
function insertEntry(
  session: Session,
  actorId: string | null,
): Promise<string> {
  return runAs(database, session, async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      insert into public.audit_log (actor_id, action, entity)
      values (${actorId}, ${TEST_ACTION}, 'prueba')
      returning id
    `;
    return takeOnlyRow(rows, "audit_log").id;
  });
}

function readVisibleEntryIds(
  session: Session,
  entryId: string,
): Promise<string[]> {
  return runAs(database, session, async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      select id from public.audit_log where id = ${entryId}
    `;
    return rows.map(({ id }) => id);
  });
}

async function readAction(entryId: string): Promise<string> {
  const rows = await database<{ action: string }[]>`
    select action from public.audit_log where id = ${entryId}
  `;
  return takeOnlyRow(rows, "audit_log").action;
}

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterAll(async () => {
  // Los usuarios con entradas no se pueden borrar: la bitácora los conserva.
  await deleteTestUsers(database);
  await database.end();
});

describeIntegration("audit_log: escritura del servidor", () => {
  it("guarda una entrada completa con created_at puesto por la base", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const entityId = admin.id;

    const entryId = await runAs(database, SERVICE, async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        insert into public.audit_log (actor_id, action, entity, entity_id, details)
        values (${admin.id}, ${TEST_ACTION}, 'profile', ${entityId},
                ${transaction.json({ motivo: "prueba" })})
        returning id
      `;
      return takeOnlyRow(rows, "audit_log").id;
    });

    const rows = await database<
      {
        actor_id: string;
        entity: string;
        entity_id: string;
        details: unknown;
        is_recent: boolean;
      }[]
    >`
      select actor_id, entity, entity_id, details,
             created_at > now() - interval '1 minute' as is_recent
      from public.audit_log where id = ${entryId}
    `;
    expect(takeOnlyRow(rows, "audit_log")).toEqual({
      actor_id: admin.id,
      entity: "profile",
      entity_id: entityId,
      details: { motivo: "prueba" },
      is_recent: true,
    });
  });

  it("no deja poner una fecha distinta a la del momento", async () => {
    const entryId = await runAs(database, SERVICE, async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        insert into public.audit_log (action, entity, created_at)
        values (${TEST_ACTION}, 'prueba', now() - interval '1 year')
        returning id
      `;
      return takeOnlyRow(rows, "audit_log").id;
    });

    const rows = await database<{ is_recent: boolean }[]>`
      select created_at > now() - interval '1 minute' as is_recent
      from public.audit_log where id = ${entryId}
    `;
    expect(takeOnlyRow(rows, "audit_log").is_recent).toBe(true);
  });

  it("acepta una entrada sin actor ni detalles", async () => {
    const entryId = await insertEntry(SERVICE, null);

    const rows = await database<
      { actor_id: string | null; details: unknown }[]
    >`
      select actor_id, details from public.audit_log where id = ${entryId}
    `;
    expect(takeOnlyRow(rows, "audit_log")).toEqual({
      actor_id: null,
      details: {},
    });
  });

  it("rechaza una acción vacía", async () => {
    await expect(
      runAs(database, SERVICE, async (transaction) => {
        await transaction`
          insert into public.audit_log (action, entity) values ('', 'prueba')
        `;
      }),
    ).rejects.toThrow(/audit_log_action_check/);
  });
});

describeIntegration("audit_log es de solo inserción", () => {
  it("la llave de servicio no puede actualizar una entrada", async () => {
    const entryId = await insertEntry(SERVICE, null);

    await expect(
      runAs(database, SERVICE, async (transaction) => {
        await transaction`
          update public.audit_log set action = 'alterada' where id = ${entryId}
        `;
      }),
    ).rejects.toThrow(/permission denied|solo inserción/i);

    expect(await readAction(entryId)).toBe(TEST_ACTION);
  });

  it("la llave de servicio no puede borrar una entrada", async () => {
    const entryId = await insertEntry(SERVICE, null);

    await expect(
      runAs(database, SERVICE, async (transaction) => {
        await transaction`delete from public.audit_log where id = ${entryId}`;
      }),
    ).rejects.toThrow(/permission denied|solo inserción/i);

    expect(await readAction(entryId)).toBe(TEST_ACTION);
  });

  it("un admin con sesión no puede actualizar ni borrar", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const entryId = await insertEntry(SERVICE, null);

    await expect(
      runAs(database, signedInAs(admin), async (transaction) => {
        await transaction`
          update public.audit_log set action = 'alterada' where id = ${entryId}
        `;
      }),
    ).rejects.toThrow(PERMISSION_DENIED);
    await expect(
      runAs(database, signedInAs(admin), async (transaction) => {
        await transaction`delete from public.audit_log where id = ${entryId}`;
      }),
    ).rejects.toThrow(PERMISSION_DENIED);

    expect(await readAction(entryId)).toBe(TEST_ACTION);
  });

  it("ni el dueño de la tabla puede actualizar una entrada", async () => {
    const entryId = await insertEntry(SERVICE, null);

    await expect(
      database`update public.audit_log set action = 'alterada' where id = ${entryId}`,
    ).rejects.toThrow(APPEND_ONLY);
  });

  it("ni el dueño de la tabla puede borrar una entrada", async () => {
    const entryId = await insertEntry(SERVICE, null);

    await expect(
      database`delete from public.audit_log where id = ${entryId}`,
    ).rejects.toThrow(APPEND_ONLY);
  });

  it("ni el dueño de la tabla puede vaciarla", async () => {
    await expect(database`truncate public.audit_log`).rejects.toThrow(
      APPEND_ONLY,
    );
  });

  it("no deja borrar a un usuario que tiene entradas a su nombre", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    await insertEntry(SERVICE, admin.id);

    await expect(
      database`delete from auth.users where id = ${admin.id}`,
    ).rejects.toThrow(/audit_log_actor_id_fkey/);
  });
});

describeIntegration("RLS de audit_log", () => {
  it("un admin activo lee las entradas", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const entryId = await insertEntry(SERVICE, null);

    expect(await readVisibleEntryIds(signedInAs(admin), entryId)).toEqual([
      entryId,
    ]);
  });

  it.each(["buyer", "staff"] as const)(
    "un %s recibe cero filas",
    async (role: UserRole) => {
      const user = await createTestUser(database, { role });
      const entryId = await insertEntry(SERVICE, null);

      expect(await readVisibleEntryIds(signedInAs(user), entryId)).toEqual([]);
    },
  );

  it("un admin desactivado recibe cero filas", async () => {
    const inactiveAdmin = await createTestUser(database, {
      role: "admin",
      isActive: false,
    });
    const entryId = await insertEntry(SERVICE, null);

    expect(
      await readVisibleEntryIds(signedInAs(inactiveAdmin), entryId),
    ).toEqual([]);
  });

  it("sin sesión recibe cero filas", async () => {
    const entryId = await insertEntry(SERVICE, null);

    expect(await readVisibleEntryIds(ANONYMOUS, entryId)).toEqual([]);
  });

  it("un admin con sesión no puede insertar directo", async () => {
    const admin = await createTestUser(database, { role: "admin" });

    await expect(insertEntry(signedInAs(admin), admin.id)).rejects.toThrow(
      PERMISSION_DENIED,
    );
  });

  it("sin sesión no se puede insertar", async () => {
    await expect(insertEntry(ANONYMOUS, null)).rejects.toThrow(
      PERMISSION_DENIED,
    );
  });
});

describeIntegration("tabla audit_log", () => {
  it("tiene RLS activado y su comentario declara scope: web", async () => {
    const rows = await database<{ has_rls: boolean; comment: string | null }[]>`
      select relrowsecurity as has_rls,
             obj_description(oid) as comment
      from pg_class where oid = 'public.audit_log'::regclass
    `;
    const table = takeOnlyRow(rows, "pg_class");

    expect(table.has_rls).toBe(true);
    expect(table.comment).toMatch(/^scope: web\b/);
  });
});
