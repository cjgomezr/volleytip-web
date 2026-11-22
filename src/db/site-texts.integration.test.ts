import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { createClient } from "@supabase/supabase-js";

import type { Database as DatabaseTypes } from "~/lib/database.types";
import { MissingSiteTextError, readSiteTexts } from "~/lib/site-texts.server";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  type Database,
  type Session,
  type TestUser,
  type Transaction,
  type UserRole,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

const ANONYMOUS: Session = { kind: "anonymous" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
// Las claves de prueba comparten prefijo para borrarlas sin tocar otras.
const KEY_PREFIX = "prueba_site_texts";
const TEST_KEY = `${KEY_PREFIX}.saludo`;
const OTHER_TEST_KEY = `${KEY_PREFIX}.despedida`;

let database: Database;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterEach(async () => {
  await database`delete from public.site_texts where key like ${`${KEY_PREFIX}%`}`;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

async function insertText(
  key: string,
  locale: string,
  value: string,
): Promise<void> {
  await database`
    insert into public.site_texts (key, locale, value)
    values (${key}, ${locale}, ${value})
  `;
}

describeIntegration("site_texts", () => {
  it("rechaza un idioma que no existe en languages", async () => {
    await expect(insertText(TEST_KEY, "zz", "Hola")).rejects.toThrow(
      /site_texts_locale_fkey/,
    );
  });

  it("rechaza repetir una clave en el mismo idioma", async () => {
    await insertText(TEST_KEY, "es", "Hola");

    await expect(insertText(TEST_KEY, "es", "Otra vez")).rejects.toThrow(
      /site_texts_pkey/,
    );
  });

  it("acepta la misma clave en otro idioma", async () => {
    await insertText(TEST_KEY, "es", "Hola");

    await expect(insertText(TEST_KEY, "en", "Hello")).resolves.toBeUndefined();
  });

  it.each([
    "Home.titulo",
    "home..titulo",
    ".home",
    "home.",
    "home titulo",
    "home-titulo",
    " home",
    "",
  ])(
    "rechaza la clave %j con un formato que no es el acordado",
    async (key) => {
      await expect(insertText(key, "es", "Hola")).rejects.toThrow(
        /site_texts_key_check/,
      );
    },
  );

  it("tiene RLS activado y comentario de ámbito", async () => {
    const [row] = await database<{ rls: boolean; comment: string }[]>`
      select c.relrowsecurity as rls, obj_description(c.oid) as comment
      from pg_class c
      where c.oid = 'public.site_texts'::regclass`;

    expect(row?.rls).toBe(true);
    expect(row?.comment).toMatch(/^scope: (shared|web)/);
  });
});

describeIntegration("site_texts: permisos", () => {
  async function openSession(who: "anonymous" | UserRole): Promise<Session> {
    if (who === "anonymous") {
      return ANONYMOUS;
    }
    return signedInAs(await createTestUser(database, { role: who }));
  }

  async function countVisibleTexts(session: Session): Promise<number> {
    return runAs(database, session, async (transaction) => {
      const rows = await transaction`
        select key from public.site_texts where key = ${TEST_KEY}`;
      return rows.length;
    });
  }

  const writes: readonly [string, (transaction: Transaction) => unknown][] = [
    [
      "insertar",
      (t) => t`insert into public.site_texts (key, locale, value)
               values (${OTHER_TEST_KEY}, 'es', 'X')`,
    ],
    [
      "actualizar",
      (t) => t`update public.site_texts set value = 'X'
               where key = ${TEST_KEY}`,
    ],
    ["borrar", (t) => t`delete from public.site_texts where key = ${TEST_KEY}`],
  ];

  for (const who of ["anonymous", "buyer", "staff"] as const) {
    it(`${who} lee los textos`, async () => {
      await insertText(TEST_KEY, "es", "Hola");

      expect(await countVisibleTexts(await openSession(who))).toBe(1);
    });

    it.each(writes)(`${who} no puede %s`, async (name, attempt) => {
      await insertText(TEST_KEY, "es", "Hola");
      const session = await openSession(who);

      // Sin permiso la base rechaza; con permiso pero sin política la
      // operación no toca ninguna fila. Ambas dejan el texto igual.
      await runAs(database, session, async (transaction) => {
        await attempt(transaction);
      }).catch((error: unknown) => {
        if (!(
          error instanceof Error && PERMISSION_DENIED.test(error.message)
        )) {
          throw error;
        }
      });

      const rows = await database<{ key: string; value: string }[]>`
        select key, value from public.site_texts where key like ${`${KEY_PREFIX}%`}`;
      expect(rows, name).toEqual([{ key: TEST_KEY, value: "Hola" }]);
    });
  }

  it("un admin inserta, actualiza y borra", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    await insertText(TEST_KEY, "es", "Hola");

    await runAs(database, signedInAs(admin), async (transaction) => {
      await transaction`insert into public.site_texts (key, locale, value)
                        values (${OTHER_TEST_KEY}, 'es', 'Chao')`;
      await transaction`update public.site_texts set value = 'Buenas'
                        where key = ${TEST_KEY}`;
    });
    const afterWrites = await database<{ key: string; value: string }[]>`
      select key, value from public.site_texts
      where key like ${`${KEY_PREFIX}%`} order by key`;
    expect(afterWrites).toEqual([
      { key: OTHER_TEST_KEY, value: "Chao" },
      { key: TEST_KEY, value: "Buenas" },
    ]);

    await runAs(database, signedInAs(admin), async (transaction) => {
      await transaction`delete from public.site_texts where key = ${TEST_KEY}`;
    });
    const afterDelete = await database`
      select key from public.site_texts where key = ${TEST_KEY}`;
    expect(afterDelete).toHaveLength(0);
  });
});

describeIntegration("textos editables", () => {
  // El lector usa el cliente público contra la base local, como en producción.
  function createLocalAnonClient(): ReturnType<
    typeof createClient<DatabaseTypes>
  > {
    return createClient<DatabaseTypes>(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_ANON_KEY ?? "",
    );
  }

  it("devuelve el inglés cuando existe", async () => {
    await insertText(TEST_KEY, "es", "Hola");
    await insertText(TEST_KEY, "en", "Hello");

    const texts = await readSiteTexts(
      [TEST_KEY],
      "en",
      createLocalAnonClient(),
    );

    expect(texts[TEST_KEY]).toBe("Hello");
  });

  it("devuelve el español cuando no hay inglés", async () => {
    await insertText(TEST_KEY, "es", "Hola");

    const texts = await readSiteTexts(
      [TEST_KEY],
      "en",
      createLocalAnonClient(),
    );

    expect(texts[TEST_KEY]).toBe("Hola");
  });

  it("devuelve el español cuando el inglés es solo espacios", async () => {
    await insertText(TEST_KEY, "es", "Hola");
    await insertText(TEST_KEY, "en", "   ");

    const texts = await readSiteTexts(
      [TEST_KEY],
      "en",
      createLocalAnonClient(),
    );

    expect(texts[TEST_KEY]).toBe("Hola");
  });

  it("lanza un error que nombra la clave inexistente", async () => {
    const missing = readSiteTexts(
      [`${KEY_PREFIX}.no_existe`],
      "en",
      createLocalAnonClient(),
    );

    await expect(missing).rejects.toThrow(MissingSiteTextError);
    await expect(missing).rejects.toThrow(/prueba_site_texts\.no_existe/);
  });

  it("lee varias claves juntas en una sola consulta", async () => {
    await insertText(TEST_KEY, "es", "Hola");
    await insertText(OTHER_TEST_KEY, "es", "Chao");
    await insertText(OTHER_TEST_KEY, "en", "Bye");
    const requests: string[] = [];
    const countingFetch: typeof fetch = (input, init) => {
      requests.push(String(input));
      return fetch(input, init);
    };
    const client = createClient<DatabaseTypes>(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_ANON_KEY ?? "",
      { global: { fetch: countingFetch } },
    );

    const texts = await readSiteTexts([TEST_KEY, OTHER_TEST_KEY], "en", client);

    expect(texts).toEqual({ [TEST_KEY]: "Hola", [OTHER_TEST_KEY]: "Bye" });
    expect(requests).toHaveLength(1);
  });
});
