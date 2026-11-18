import { afterAll, beforeAll, expect, it } from "vitest";

import { createAnonSupabaseClient } from "~/lib/supabase/anon-client.server";
import {
  buildTestEmail,
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  insertAuthUser as insertAuthUserInto,
  runAs,
  takeOnlyRow,
  type Database,
  type Session,
  type TestUser,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

interface Profile {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly full_name: string | null;
  readonly locale: string;
  readonly is_active: boolean;
}

const ANONYMOUS: Session = { kind: "anonymous" };
const SERVICE: Session = { kind: "service" };
const PERMISSION_DENIED = /permission denied|row-level security|protegid/i;

let database: Database;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

async function readProfile(userId: string): Promise<Profile> {
  const [profile] = await database<Profile[]>`
    select id, email::text as email, role::text as role, full_name, locale, is_active
    from public.profiles where id = ${userId}
  `;
  if (profile === undefined) {
    throw new Error(`No existe el perfil ${userId}`);
  }
  return profile;
}

function readVisibleProfileIds(session: Session): Promise<string[]> {
  return runAs(database, session, async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      select id from public.profiles
    `;
    return rows.map(({ id }) => id);
  });
}

function callIsAdmin(session: Session): Promise<boolean> {
  return runAs(database, session, async (transaction) => {
    const rows = await transaction<{ is_admin: boolean }[]>`
      select public.is_admin() as is_admin
    `;
    return takeOnlyRow(rows, "is_admin()").is_admin;
  });
}

function insertAuthUser(email: string | null): Promise<string> {
  return insertAuthUserInto(database, email);
}

// Cuenta solo los usuarios sin correo, no todos: otros archivos de
// integración crean usuarios en paralelo contra la misma base.
async function countAuthUsersWithoutEmail(): Promise<number> {
  const rows = await database<{ total: number }[]>`
    select count(*)::int as total from auth.users
    where email is null or btrim(email) = ''
  `;
  return takeOnlyRow(rows, "el conteo de auth.users").total;
}

/** Intenta un cambio sobre un perfil con la sesión dada. Devuelve cuántas
 * filas cambió; lanza si la base lo rechaza. */
function updateProfile(
  session: Session,
  userId: string,
  changes: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  return runAs(database, session, async (transaction) => {
    const result = await transaction`
      update public.profiles set ${transaction(changes)} where id = ${userId}
    `;
    return result.count;
  });
}

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

describeIntegration("alta de perfil", () => {
  it("un usuario nuevo recibe un perfil buyer activo con su mismo id", async () => {
    const email = buildTestEmail();

    const userId = await insertAuthUser(email);

    expect(await readProfile(userId)).toMatchObject({
      id: userId,
      email,
      role: "buyer",
      is_active: true,
    });
  });

  it("el correo queda en minúsculas y sin espacios", async () => {
    const email = buildTestEmail();

    const userId = await insertAuthUser(`  ${email.toUpperCase()} `);

    expect((await readProfile(userId)).email).toBe(email);
  });

  it.each([null, "", "   "])(
    "un usuario con correo %j no se crea: no queda usuario sin perfil",
    async (email) => {
      await expect(insertAuthUser(email)).rejects.toThrow(/correo/i);

      expect(await countAuthUsersWithoutEmail()).toBe(0);
    },
  );

  it("rechaza un segundo perfil con el mismo correo en otra capitalización", async () => {
    const email = buildTestEmail();
    await insertAuthUser(email);

    await expect(insertAuthUser(email.toUpperCase())).rejects.toThrow(
      /profiles_email_key|duplicate key/i,
    );
  });

  it("borrar el usuario de Auth borra su perfil", async () => {
    const userId = await insertAuthUser(buildTestEmail());

    await database`delete from auth.users where id = ${userId}`;

    await expect(readProfile(userId)).rejects.toThrow(/No existe el perfil/);
  });
});

describeIntegration("correo del perfil", () => {
  it("sigue al de Auth cuando la persona cambia su correo", async () => {
    const user = await createTestUser(database);
    const newEmail = buildTestEmail();

    await database`
      update auth.users set email = ${` ${newEmail.toUpperCase()} `}
      where id = ${user.id}
    `;

    expect((await readProfile(user.id)).email).toBe(newEmail);
  });

  it("no deja a un usuario de Auth sin correo", async () => {
    const user = await createTestUser(database);

    await expect(
      database`update auth.users set email = null where id = ${user.id}`,
    ).rejects.toThrow(/correo/i);

    expect((await readProfile(user.id)).email).toBe(user.email);
  });
});

describeIntegration("RLS de profiles: comprador", () => {
  it("lee solo su fila", async () => {
    const buyer = await createTestUser(database);
    await createTestUser(database);

    expect(await readVisibleProfileIds(signedInAs(buyer))).toEqual([buyer.id]);
  });

  it("guarda su full_name y su locale", async () => {
    const buyer = await createTestUser(database);

    await updateProfile(signedInAs(buyer), buyer.id, {
      full_name: "Ana Pérez",
      locale: "en",
    });

    expect(await readProfile(buyer.id)).toMatchObject({
      full_name: "Ana Pérez",
      locale: "en",
    });
  });

  it("actualiza updated_at al editar", async () => {
    const buyer = await createTestUser(database);
    await database`
      update public.profiles set updated_at = now() - interval '1 day'
      where id = ${buyer.id}
    `;

    await updateProfile(signedInAs(buyer), buyer.id, { full_name: "Ana" });

    const rows = await database<{ is_recent: boolean }[]>`
      select updated_at > now() - interval '1 minute' as is_recent
      from public.profiles where id = ${buyer.id}
    `;
    expect(takeOnlyRow(rows, "profiles").is_recent).toBe(true);
  });

  it.each([
    ["role", "admin"],
    ["role", "staff"],
    ["email", "otro@prueba.volleytip.test"],
    ["is_active", false],
  ] as const)(
    "no puede cambiar %s a %j y la fila no cambia",
    async (column, value) => {
      const buyer = await createTestUser(database);
      const before = await readProfile(buyer.id);

      await expect(
        updateProfile(signedInAs(buyer), buyer.id, { [column]: value }),
      ).rejects.toThrow(PERMISSION_DENIED);

      expect(await readProfile(buyer.id)).toEqual(before);
    },
  );

  it("no acepta un locale fuera de es y en", async () => {
    const buyer = await createTestUser(database);

    await expect(
      updateProfile(signedInAs(buyer), buyer.id, { locale: "fr" }),
    ).rejects.toThrow(/profiles_locale_check/);
  });

  it("no puede editar la fila de otra persona", async () => {
    const buyer = await createTestUser(database);
    const other = await createTestUser(database);

    const changedRows = await updateProfile(signedInAs(buyer), other.id, {
      full_name: "Intruso",
    });

    expect(changedRows).toBe(0);
    expect((await readProfile(other.id)).full_name).toBeNull();
  });

  it("no puede insertar perfiles", async () => {
    const buyer = await createTestUser(database);

    await expect(
      runAs(database, signedInAs(buyer), async (transaction) => {
        await transaction`
          insert into public.profiles (id, email)
          values (gen_random_uuid(), ${buildTestEmail()})
        `;
      }),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  it("no puede borrar su perfil", async () => {
    const buyer = await createTestUser(database);

    await expect(
      runAs(database, signedInAs(buyer), async (transaction) => {
        await transaction`delete from public.profiles where id = ${buyer.id}`;
      }),
    ).rejects.toThrow(PERMISSION_DENIED);

    expect((await readProfile(buyer.id)).id).toBe(buyer.id);
  });
});

describeIntegration("RLS de profiles: staff", () => {
  it("lee solo su fila", async () => {
    const staff = await createTestUser(database, { role: "staff" });
    await createTestUser(database);

    expect(await readVisibleProfileIds(signedInAs(staff))).toEqual([staff.id]);
  });

  it("no puede editar su fila", async () => {
    const staff = await createTestUser(database, { role: "staff" });

    const changedRows = await updateProfile(signedInAs(staff), staff.id, {
      full_name: "Cambio",
    });

    expect(changedRows).toBe(0);
    expect((await readProfile(staff.id)).full_name).toBeNull();
  });
});

describeIntegration("RLS de profiles: admin", () => {
  it("lee todas las filas", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const buyer = await createTestUser(database);
    const staff = await createTestUser(database, { role: "staff" });

    const visible = await readVisibleProfileIds(signedInAs(admin));

    expect(visible).toEqual(
      expect.arrayContaining([admin.id, buyer.id, staff.id]),
    );
  });

  it("edita la fila de otra persona, incluidos role e is_active", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const buyer = await createTestUser(database);

    await updateProfile(signedInAs(admin), buyer.id, {
      role: "staff",
      is_active: false,
      full_name: "Nuevo staff",
    });

    expect(await readProfile(buyer.id)).toMatchObject({
      role: "staff",
      is_active: false,
      full_name: "Nuevo staff",
    });
  });

  it("desactivado, solo ve su propia fila", async () => {
    const inactiveAdmin = await createTestUser(database, {
      role: "admin",
      isActive: false,
    });
    await createTestUser(database);

    expect(await readVisibleProfileIds(signedInAs(inactiveAdmin))).toEqual([
      inactiveAdmin.id,
    ]);
  });

  it("desactivado, su intento de reactivarse no cambia ninguna fila", async () => {
    const inactiveAdmin = await createTestUser(database, {
      role: "admin",
      isActive: false,
    });

    const changedRows = await updateProfile(
      signedInAs(inactiveAdmin),
      inactiveAdmin.id,
      { is_active: true },
    );

    expect(changedRows).toBe(0);
    expect((await readProfile(inactiveAdmin.id)).is_active).toBe(false);
  });

  it("desactivado, no puede editar a otros", async () => {
    const inactiveAdmin = await createTestUser(database, {
      role: "admin",
      isActive: false,
    });
    const buyer = await createTestUser(database);

    const changedRows = await updateProfile(
      signedInAs(inactiveAdmin),
      buyer.id,
      { full_name: "Intruso" },
    );

    expect(changedRows).toBe(0);
    expect((await readProfile(buyer.id)).full_name).toBeNull();
  });
});

describeIntegration("profiles con la llave de servicio", () => {
  it("el servidor puede cambiar el rol de un perfil", async () => {
    const buyer = await createTestUser(database);

    await updateProfile(SERVICE, buyer.id, { role: "admin" });

    expect((await readProfile(buyer.id)).role).toBe("admin");
  });

  it("el servidor puede desactivar un perfil", async () => {
    const staff = await createTestUser(database, { role: "staff" });

    await updateProfile(SERVICE, staff.id, { is_active: false });

    expect((await readProfile(staff.id)).is_active).toBe(false);
  });
});

describeIntegration("RLS de profiles: sin sesión", () => {
  it("recibe cero filas", async () => {
    await createTestUser(database);

    expect(await readVisibleProfileIds(ANONYMOUS)).toEqual([]);
  });

  it("recibe cero filas por la API con la llave pública", async () => {
    await createTestUser(database);

    const { data, error } = await createAnonSupabaseClient()
      .from("profiles")
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("no puede escribir", async () => {
    const buyer = await createTestUser(database);

    await expect(
      updateProfile(ANONYMOUS, buyer.id, { full_name: "Intruso" }),
    ).rejects.toThrow(PERMISSION_DENIED);

    expect((await readProfile(buyer.id)).full_name).toBeNull();
  });
});

describeIntegration("is_admin", () => {
  it("es verdadero para un admin activo", async () => {
    const admin = await createTestUser(database, { role: "admin" });

    expect(await callIsAdmin(signedInAs(admin))).toBe(true);
  });

  it.each([
    ["buyer", true],
    ["staff", true],
    ["admin", false],
  ] as const)("es falso para %s con is_active = %s", async (role, isActive) => {
    const user = await createTestUser(database, { role, isActive });

    expect(await callIsAdmin(signedInAs(user))).toBe(false);
  });

  it("sin sesión no se puede llamar", async () => {
    await expect(callIsAdmin(ANONYMOUS)).rejects.toThrow(PERMISSION_DENIED);
  });
});

describeIntegration("AC-033: el rol buyer no obtiene acceso de admin", () => {
  it("un comprador recién creado no pasa is_admin ni ve filas ajenas", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const buyer = await createTestUser(database);

    expect(await callIsAdmin(signedInAs(buyer))).toBe(false);
    expect(await readVisibleProfileIds(signedInAs(buyer))).not.toContain(
      admin.id,
    );
  });

  it("un comprador no puede editar la fila de un admin", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const buyer = await createTestUser(database);

    const changedRows = await updateProfile(signedInAs(buyer), admin.id, {
      full_name: "Intruso",
    });

    expect(changedRows).toBe(0);
  });

  // Complemento de las pruebas de comportamiento de arriba, no su reemplazo:
  // solo avisa si alguien agrega una política que no nombra ni a quien
  // consulta ni a is_admin().
  it("toda política de profiles nombra auth.uid() o is_admin()", async () => {
    const policies = await database<{ name: string; rule: string }[]>`
      select policyname as name,
             coalesce(qual, '') || ' ' || coalesce(with_check, '') as rule
      from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
    `;

    expect(policies.length).toBeGreaterThan(0);
    for (const { name, rule } of policies) {
      const alternatives = rule.split(/\sOR\s/i);
      const openAlternatives = alternatives.filter(
        (alternative) =>
          !alternative.includes("uid()") && !alternative.includes("is_admin()"),
      );
      expect(openAlternatives, name).toEqual([]);
    }
  });

  it("ninguna política se da al rol anon ni a public", async () => {
    const policies = await database<{ roles: string[] }[]>`
      select roles::text[] as roles from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
    `;
    const grantedRoles = policies.flatMap(({ roles }) => roles);

    expect(grantedRoles).not.toContain("anon");
    expect(grantedRoles).not.toContain("public");
  });
});

describeIntegration("tabla profiles", () => {
  it("tiene RLS activado", async () => {
    const rows = await database<{ has_rls: boolean }[]>`
      select relrowsecurity as has_rls from pg_class
      where oid = 'public.profiles'::regclass
    `;

    expect(takeOnlyRow(rows, "pg_class").has_rls).toBe(true);
  });

  it("su comentario declara scope: shared", async () => {
    const rows = await database<{ comment: string | null }[]>`
      select obj_description('public.profiles'::regclass) as comment
    `;

    expect(takeOnlyRow(rows, "el comentario").comment).toMatch(
      /^scope: shared\b/,
    );
  });
});

describeIntegration("enums base", () => {
  // Lista completa de los enums de `public`. La épica que cree un enum nuevo
  // lo agrega aquí a propósito: así ninguno aparece sin que alguien lo vea.
  it("existen user_role y publish_status con sus valores exactos, y ningún otro", async () => {
    const enums = await database<{ name: string; labels: string[] }[]>`
      select t.typname as name,
             array_agg(e.enumlabel::text order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
      group by t.typname
      order by t.typname
    `;

    expect(enums.map(({ name, labels }) => ({ name, labels }))).toEqual([
      { name: "publish_status", labels: ["draft", "published", "retired"] },
      { name: "user_role", labels: ["admin", "staff", "buyer"] },
    ]);
  });
});
