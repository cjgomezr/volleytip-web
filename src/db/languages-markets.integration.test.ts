import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "~/lib/i18n/languages";
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
// Los idiomas y mercados de prueba usan códigos que el sitio no sirve.
const TEST_LANGUAGE = "zz";
const TEST_COUNTRY = "ZZ";

interface LanguageRow {
  readonly code: string;
  readonly name: string;
  readonly is_default: boolean;
  readonly is_active: boolean;
}

interface MarketRow {
  readonly country_code: string;
  readonly currency: string;
  readonly default_locale: string;
  readonly ships_physical: boolean;
  readonly is_active: boolean;
}

interface VisibleRows {
  readonly languages: readonly string[];
  readonly countries: readonly string[];
}

let database: Database;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterEach(async () => {
  await database`delete from public.markets where country_code = ${TEST_COUNTRY}`;
  await database`delete from public.languages where code = ${TEST_LANGUAGE}`;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

async function insertTestLanguage(isActive: boolean): Promise<void> {
  await database`
    insert into public.languages (code, name, is_default, is_active)
    values (${TEST_LANGUAGE}, 'Prueba', false, ${isActive})
  `;
}

async function insertTestMarket(isActive: boolean): Promise<void> {
  await database`
    insert into public.markets (country_code, currency, default_locale, ships_physical, is_active)
    values (${TEST_COUNTRY}, 'ZZZ', 'es', false, ${isActive})
  `;
}

function readVisibleRows(session: Session): Promise<VisibleRows> {
  return runAs(database, session, async (transaction) => {
    const languages = await transaction<{ code: string }[]>`
      select code from public.languages order by code`;
    const markets = await transaction<{ country_code: string }[]>`
      select country_code from public.markets order by country_code`;
    return {
      languages: languages.map(({ code }) => code),
      countries: markets.map(({ country_code }) => country_code),
    };
  });
}

describeIntegration("languages", () => {
  it("trae es por defecto y en, los dos activos y con su nombre", async () => {
    const rows = await database<LanguageRow[]>`
      select code, name, is_default, is_active from public.languages
      order by code`;

    expect(rows).toEqual([
      { code: "en", name: "English", is_default: false, is_active: true },
      { code: "es", name: "Español", is_default: true, is_active: true },
    ]);
  });

  it("rechaza marcar un segundo idioma por defecto", async () => {
    await expect(
      database`insert into public.languages (code, name, is_default)
               values (${TEST_LANGUAGE}, 'Prueba', true)`,
    ).rejects.toThrow(/languages_single_default_idx/);
  });

  it.each(["ES", "e", "esp", "e1", ""])(
    "rechaza el código %j que no son dos letras minúsculas",
    async (code) => {
      await expect(
        database`insert into public.languages (code, name) values (${code}, 'X')`,
      ).rejects.toThrow(/languages_code_check/);
    },
  );
});

describeIntegration("markets", () => {
  it("trae Colombia: COP, español, envía físicos, activo", async () => {
    const rows = await database<MarketRow[]>`
      select country_code, currency, default_locale, ships_physical, is_active
      from public.markets`;

    expect(rows).toEqual([
      {
        country_code: "CO",
        currency: "COP",
        default_locale: "es",
        ships_physical: true,
        is_active: true,
      },
    ]);
  });

  it.each(["co", "C", "COL", "C1"])(
    "rechaza el país %j que no son dos letras mayúsculas",
    async (country) => {
      await expect(
        database`insert into public.markets (country_code, currency, default_locale)
                 values (${country}, 'ZZZ', 'es')`,
      ).rejects.toThrow(/markets_country_code_check/);
    },
  );

  it.each(["cop", "CO", "COPP", "C0P"])(
    "rechaza la moneda %j que no son tres letras mayúsculas",
    async (currency) => {
      await expect(
        database`insert into public.markets (country_code, currency, default_locale)
                 values (${TEST_COUNTRY}, ${currency}, 'es')`,
      ).rejects.toThrow(/markets_currency_check/);
    },
  );

  it("rechaza un segundo mercado para el mismo país", async () => {
    await expect(
      database`insert into public.markets (country_code, currency, default_locale)
               values ('CO', 'USD', 'es')`,
    ).rejects.toThrow(/markets_country_code_key/);
  });

  it("rechaza un idioma por defecto que no existe en languages", async () => {
    await expect(
      database`insert into public.markets (country_code, currency, default_locale)
               values (${TEST_COUNTRY}, 'ZZZ', ${TEST_LANGUAGE})`,
    ).rejects.toThrow(/markets_default_locale_fkey/);
  });
});

describeIntegration("languages y markets: lectura", () => {
  it("un anónimo ve solo las filas activas", async () => {
    await insertTestLanguage(false);
    await insertTestMarket(false);

    expect(await readVisibleRows(ANONYMOUS)).toEqual({
      languages: ["en", "es"],
      countries: ["CO"],
    });
  });

  it.each(["buyer", "staff"] as const)(
    "un %s con sesión ve lo mismo que un anónimo",
    async (role: UserRole) => {
      const user = await createTestUser(database, { role });
      await insertTestLanguage(false);
      await insertTestMarket(false);

      expect(await readVisibleRows(signedInAs(user))).toEqual({
        languages: ["en", "es"],
        countries: ["CO"],
      });
    },
  );

  it("un admin ve todas las filas, activas o no", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    await insertTestLanguage(false);
    await insertTestMarket(false);

    expect(await readVisibleRows(signedInAs(admin))).toEqual({
      languages: ["en", "es", TEST_LANGUAGE],
      countries: ["CO", TEST_COUNTRY],
    });
  });
});

describeIntegration("languages y markets: escritura", () => {
  it("un admin inserta y actualiza idiomas y mercados", async () => {
    const admin = await createTestUser(database, { role: "admin" });

    await runAs(database, signedInAs(admin), async (transaction) => {
      await transaction`insert into public.languages (code, name)
                        values (${TEST_LANGUAGE}, 'Prueba')`;
      await transaction`insert into public.markets (country_code, currency, default_locale)
                        values (${TEST_COUNTRY}, 'ZZZ', 'es')`;
      await transaction`update public.languages set name = 'Otra'
                        where code = ${TEST_LANGUAGE}`;
      await transaction`update public.markets set currency = 'YYY'
                        where country_code = ${TEST_COUNTRY}`;
    });

    const [language] = await database<LanguageRow[]>`
      select code, name, is_default, is_active from public.languages
      where code = ${TEST_LANGUAGE}`;
    const [market] = await database<MarketRow[]>`
      select country_code, currency, default_locale, ships_physical, is_active
      from public.markets where country_code = ${TEST_COUNTRY}`;
    expect(language?.name).toBe("Otra");
    expect(market?.currency).toBe("YYY");
  });

  it("nadie borra por la API, ni un admin", async () => {
    const admin = await createTestUser(database, { role: "admin" });

    await expect(
      runAs(database, signedInAs(admin), async (transaction) => {
        await transaction`delete from public.markets where country_code = 'CO'`;
      }),
    ).rejects.toThrow(PERMISSION_DENIED);
    await expect(
      runAs(database, signedInAs(admin), async (transaction) => {
        await transaction`delete from public.languages where code = 'en'`;
      }),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  async function openSession(
    who: "anonymous" | "buyer" | "staff",
  ): Promise<Session> {
    if (who === "anonymous") {
      return ANONYMOUS;
    }
    return signedInAs(await createTestUser(database, { role: who }));
  }

  const attempts: readonly [string, (transaction: Transaction) => unknown][] = [
    [
      "insertar un idioma",
      (t) =>
        t`insert into public.languages (code, name) values (${TEST_LANGUAGE}, 'X')`,
    ],
    [
      "insertar un mercado",
      (t) =>
        t`insert into public.markets (country_code, currency, default_locale)
          values (${TEST_COUNTRY}, 'ZZZ', 'es')`,
    ],
    [
      "borrar un idioma",
      (t) => t`delete from public.languages where code = 'en'`,
    ],
    [
      "borrar un mercado",
      (t) => t`delete from public.markets where country_code = 'CO'`,
    ],
  ];

  for (const who of ["anonymous", "buyer", "staff"] as const) {
    it.each(attempts)(`${who} no puede %s`, async (_name, attempt) => {
      const session = await openSession(who);

      await expect(
        runAs(database, session, async (transaction) => {
          await attempt(transaction);
        }),
      ).rejects.toThrow(PERMISSION_DENIED);
    });

    it(`${who} no cambia idiomas ni mercados al actualizar`, async () => {
      const session = await openSession(who);

      // Sin permiso de columna la base rechaza; con permiso pero sin política
      // la actualización no toca ninguna fila. Las dos dejan los datos igual.
      await runAs(database, session, async (transaction) => {
        await transaction`update public.markets set currency = 'XXX'`;
      }).catch((error: unknown) => {
        if (!(
          error instanceof Error && PERMISSION_DENIED.test(error.message)
        )) {
          throw error;
        }
      });
      await runAs(database, session, async (transaction) => {
        await transaction`update public.languages set name = 'X'`;
      }).catch((error: unknown) => {
        if (!(
          error instanceof Error && PERMISSION_DENIED.test(error.message)
        )) {
          throw error;
        }
      });

      const [market] = await database<MarketRow[]>`
        select country_code, currency, default_locale, ships_physical, is_active
        from public.markets where country_code = 'CO'`;
      expect(market?.currency).toBe("COP");
      const [english] = await database<LanguageRow[]>`
        select code, name, is_default, is_active from public.languages
        where code = 'en'`;
      expect(english?.name).toBe("English");
    });
  }
});

describeIntegration("idiomas del código y de la base", () => {
  type Reader = Database | Transaction;

  async function listActiveLanguageCodes(
    reader: Reader,
  ): Promise<readonly string[]> {
    const rows = await (reader as Database)<{ code: string }[]>`
      select code from public.languages where is_active order by code`;
    return rows.map(({ code }) => code);
  }

  function describeDifferences(
    codeCodes: readonly string[],
    databaseCodes: readonly string[],
  ): string[] {
    const missing = codeCodes.filter((code) => !databaseCodes.includes(code));
    const extra = databaseCodes.filter((code) => !codeCodes.includes(code));
    return [
      ...missing.map((code) => `falta en la base: ${code}`),
      ...extra.map((code) => `sobra en la base: ${code}`),
    ];
  }

  const codeCodes = SUPPORTED_LANGUAGES.map(({ code }) => code);

  it("coinciden los idiomas del código y los activos de la base", async () => {
    const differences = describeDifferences(
      codeCodes,
      await listActiveLanguageCodes(database),
    );

    expect(differences, differences.join("; ")).toEqual([]);
  });

  it("dice qué idioma falta si se desactiva uno, sin dejar el cambio", async () => {
    const rollback = new Error("revertir la prueba");
    let differences: string[] = [];

    await database
      .begin(async (transaction) => {
        await transaction`update public.languages set is_active = false where code = 'en'`;
        differences = describeDifferences(
          codeCodes,
          await listActiveLanguageCodes(transaction),
        );
        throw rollback;
      })
      .catch((error: unknown) => {
        if (error !== rollback) {
          throw error;
        }
      });

    expect(differences).toEqual(["falta en la base: en"]);
    expect(await listActiveLanguageCodes(database)).toEqual(["en", "es"]);
  });
});
