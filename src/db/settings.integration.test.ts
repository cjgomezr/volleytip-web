import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

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

interface Setting {
  readonly key: string;
  readonly value: unknown;
  readonly updated_by: string | null;
  readonly is_recent: boolean;
}

const ANONYMOUS: Session = { kind: "anonymous" };
const SERVICE: Session = { kind: "service" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
// Las claves de prueba llevan este prefijo para borrarlas sin tocar otras.
const TEST_KEY_PREFIX = "prueba.rls.";
// Toda clave de prueba, de este archivo o de otro, empieza así.
const ANY_TEST_KEY = "prueba.%";

let database: Database;
let keyCounter = 0;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

function buildTestKey(): string {
  keyCounter += 1;
  return `${TEST_KEY_PREFIX}${Date.now()}.${keyCounter}`;
}

async function seedSetting(value: unknown): Promise<string> {
  const key = buildTestKey();
  await database`
    insert into public.settings (key, value)
    values (${key}, ${JSON.stringify(value)}::text::jsonb)
  `;
  return key;
}

async function readSettingRow(key: string): Promise<Setting> {
  const rows = await database<Setting[]>`
    select key, value, updated_by,
           updated_at > now() - interval '1 minute' as is_recent
    from public.settings where key = ${key}
  `;
  return takeOnlyRow(rows, `settings (${key})`);
}

function readVisibleKeys(session: Session): Promise<string[]> {
  return runAs(database, session, async (transaction) => {
    const rows = await transaction<{ key: string }[]>`
      select key from public.settings
    `;
    return rows.map(({ key }) => key);
  });
}

/** Intenta cambiar el valor de un ajuste. Devuelve cuántas filas cambió. */
function updateSetting(
  session: Session,
  key: string,
  value: unknown,
): Promise<number> {
  return runAs(database, session, async (transaction) => {
    const result = await transaction`
      update public.settings set value = ${transaction.json(value as never)}
      where key = ${key}
    `;
    return result.count;
  });
}

function insertSetting(session: Session, key: string): Promise<number> {
  return runAs(database, session, async (transaction) => {
    const result = await transaction`
      insert into public.settings (key, value) values (${key}, 'true'::jsonb)
    `;
    return result.count;
  });
}

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterEach(async () => {
  await database`
    delete from public.settings where key like ${`${TEST_KEY_PREFIX}%`}
  `;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

describeIntegration("RLS de settings", () => {
  it("sin sesión recibe cero filas", async () => {
    await seedSetting(true);

    expect(await readVisibleKeys(ANONYMOUS)).toEqual([]);
  });

  it.each(["buyer", "staff"] as const)(
    "un %s recibe cero filas",
    async (role: UserRole) => {
      const user = await createTestUser(database, { role });
      await seedSetting(true);

      expect(await readVisibleKeys(signedInAs(user))).toEqual([]);
    },
  );

  it("un admin desactivado recibe cero filas", async () => {
    const inactiveAdmin = await createTestUser(database, {
      role: "admin",
      isActive: false,
    });
    await seedSetting(true);

    expect(await readVisibleKeys(signedInAs(inactiveAdmin))).toEqual([]);
  });

  it("sin sesión no puede escribir", async () => {
    const key = await seedSetting(true);

    await expect(updateSetting(ANONYMOUS, key, false)).rejects.toThrow(
      PERMISSION_DENIED,
    );
    await expect(insertSetting(ANONYMOUS, buildTestKey())).rejects.toThrow(
      PERMISSION_DENIED,
    );

    expect((await readSettingRow(key)).value).toBe(true);
  });

  it.each(["buyer", "staff"] as const)(
    "un %s no puede cambiar ni crear ajustes",
    async (role: UserRole) => {
      const user = await createTestUser(database, { role });
      const key = await seedSetting(true);

      const changedRows = await updateSetting(signedInAs(user), key, false);
      await expect(
        insertSetting(signedInAs(user), buildTestKey()),
      ).rejects.toThrow(PERMISSION_DENIED);

      expect(changedRows).toBe(0);
      expect((await readSettingRow(key)).value).toBe(true);
    },
  );

  it("un admin desactivado no puede cambiar ni crear ajustes", async () => {
    const inactiveAdmin = await createTestUser(database, {
      role: "admin",
      isActive: false,
    });
    const key = await seedSetting(true);

    const changedRows = await updateSetting(
      signedInAs(inactiveAdmin),
      key,
      false,
    );
    await expect(
      insertSetting(signedInAs(inactiveAdmin), buildTestKey()),
    ).rejects.toThrow(PERMISSION_DENIED);

    expect(changedRows).toBe(0);
    expect((await readSettingRow(key)).value).toBe(true);
  });

  it("un admin no puede renombrar la clave de un ajuste", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const key = await seedSetting(true);

    await runAs(database, signedInAs(admin), async (transaction) => {
      await transaction`
        update public.settings set key = ${buildTestKey()} where key = ${key}
      `;
    });

    expect((await readSettingRow(key)).key).toBe(key);
  });

  it("un admin activo lee los ajustes", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const key = await seedSetting({ enabled: true });

    expect(await readVisibleKeys(signedInAs(admin))).toContain(key);
  });

  it("un admin activo actualiza un ajuste", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const key = await seedSetting({ enabled: false });

    await updateSetting(signedInAs(admin), key, { enabled: true });

    expect((await readSettingRow(key)).value).toEqual({ enabled: true });
  });

  it("un admin activo crea un ajuste", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const key = buildTestKey();

    await insertSetting(signedInAs(admin), key);

    expect((await readSettingRow(key)).updated_by).toBe(admin.id);
  });

  it("nadie borra un ajuste por la API, ni un admin", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const key = await seedSetting(true);

    await expect(
      runAs(database, signedInAs(admin), async (transaction) => {
        await transaction`delete from public.settings where key = ${key}`;
      }),
    ).rejects.toThrow(PERMISSION_DENIED);
  });
});

describeIntegration("settings: quién y cuándo", () => {
  it("la base pone updated_by y updated_at cuando un admin actualiza", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const key = await seedSetting(1);
    await database`
      update public.settings set updated_at = now() - interval '1 day'
      where key = ${key}
    `;

    await updateSetting(signedInAs(admin), key, 2);

    expect(await readSettingRow(key)).toMatchObject({
      updated_by: admin.id,
      is_recent: true,
    });
  });

  it("un admin no puede atribuirle el cambio a otra persona", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const other = await createTestUser(database, { role: "admin" });
    const key = await seedSetting(1);

    await runAs(database, signedInAs(admin), async (transaction) => {
      await transaction`
        update public.settings
        set value = '2'::jsonb, updated_by = ${other.id},
            updated_at = now() - interval '1 year'
        where key = ${key}
      `;
    });

    expect(await readSettingRow(key)).toMatchObject({
      updated_by: admin.id,
      is_recent: true,
    });
  });

  it("el servidor puede escribir un ajuste indicando quién lo cambió", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const key = await seedSetting(1);

    await runAs(database, SERVICE, async (transaction) => {
      await transaction`
        update public.settings
        set value = '2'::jsonb, updated_by = ${admin.id}
        where key = ${key}
      `;
    });

    expect(await readSettingRow(key)).toMatchObject({
      value: 2,
      updated_by: admin.id,
    });
  });
});

describeIntegration("tabla settings", () => {
  it("no tiene ninguna clave sembrada", async () => {
    // Fuera de las claves de prueba, que otros archivos crean en paralelo.
    const rows = await database<{ total: number }[]>`
      select count(*)::int as total from public.settings
      where key not like ${ANY_TEST_KEY}
    `;

    expect(takeOnlyRow(rows, "el conteo de settings").total).toBe(0);
  });

  it("tiene RLS activado y su comentario declara scope: web", async () => {
    const rows = await database<{ has_rls: boolean; comment: string | null }[]>`
      select relrowsecurity as has_rls,
             obj_description(oid) as comment
      from pg_class where oid = 'public.settings'::regclass
    `;
    const table = takeOnlyRow(rows, "pg_class");

    expect(table.has_rls).toBe(true);
    expect(table.comment).toMatch(/^scope: web\b/);
  });

  it("rechaza una clave vacía o con espacios alrededor", async () => {
    await expect(
      database`insert into public.settings (key, value) values (' ', 'true'::jsonb)`,
    ).rejects.toThrow(/settings_key_check/);
  });
});
