import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { MARKET_PAYMENT_METHODS } from "~/lib/payment-methods";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  type Database,
  type Transaction,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

// Códigos que el sitio no sirve.
const TEST_LANGUAGE = "zz";
const TEST_COUNTRY = "ZZ";
const LAST_MARKET = /markets_last_active_check/;
// Cuánto se espera a que la segunda transacción quede detenida en el bloqueo.
const BLOCKED_WAIT_MS = 3000;
const POLL_MS = 25;

let database: Database;

beforeAll(() => {
  database = connectToLocalDatabase();
});

// Colombia vuelve a como la dejan las migraciones, pase lo que pase.
afterEach(async () => {
  await database`
    update public.markets
    set is_active = true, default_locale = 'es', payment_methods = '{}'
    where country_code = 'CO'`;
  await database`delete from public.markets where country_code = ${TEST_COUNTRY}`;
  await database`delete from public.languages where code = ${TEST_LANGUAGE}`;
  await database`update public.languages set is_active = true where code = 'en'`;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

async function insertTestMarket(): Promise<void> {
  await database`
    insert into public.markets (country_code, currency, default_locale, is_active)
    values (${TEST_COUNTRY}, 'ZZZ', 'es', true)`;
}

async function insertInactiveLanguage(): Promise<void> {
  await database`
    insert into public.languages (code, name, is_active)
    values (${TEST_LANGUAGE}, 'Prueba', false)`;
}

function deactivate(
  transaction: Database | Transaction,
  country: string,
): PromiseLike<unknown> {
  return (transaction as Database)`
    update public.markets set is_active = false where country_code = ${country}`;
}

async function listActiveCountries(): Promise<readonly string[]> {
  const rows = await database<{ country_code: string }[]>`
    select country_code from public.markets where is_active
    order by country_code`;
  return rows.map(({ country_code }) => country_code);
}

async function waitForBlockedSession(): Promise<void> {
  const deadline = Date.now() + BLOCKED_WAIT_MS;
  while (Date.now() < deadline) {
    const [row] = await database<{ blocked: boolean }[]>`
      select exists (select 1 from pg_locks where not granted) as blocked`;
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("La segunda transacción nunca quedó esperando el bloqueo.");
}

/** Dos transacciones desactivan a la vez Colombia y el mercado de prueba: la
 * segunda actúa mientras la primera todavía no ha confirmado. */
async function deactivateBothAtOnce(
  isolation: string,
): Promise<PromiseSettledResult<unknown>[]> {
  let releaseFirst: () => void = () => undefined;
  const firstMayCommit = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstDone: () => void = () => undefined;
  const firstHasUpdated = new Promise<void>((resolve) => {
    markFirstDone = resolve;
  });
  // Cada una con su conexión: la de las pruebas es una sola.
  const firstConnection = connectToLocalDatabase();
  const secondConnection = connectToLocalDatabase();
  const first = firstConnection.begin(isolation, async (transaction) => {
    // Fija la foto de la transacción antes de que la otra cambie nada.
    await transaction`select count(*) from public.markets`;
    await deactivate(transaction, "CO");
    markFirstDone();
    await firstMayCommit;
  });
  await Promise.race([firstHasUpdated, first]);
  const second = secondConnection.begin(isolation, async (transaction) => {
    await transaction`select count(*) from public.markets`;
    await deactivate(transaction, TEST_COUNTRY);
  });
  // Se observa desde ya: si fallara antes de tiempo no quedaría sin manejar.
  const results = Promise.allSettled([first, second]);
  try {
    await waitForBlockedSession();
  } finally {
    releaseFirst();
    await results;
    await Promise.all([firstConnection.end(), secondConnection.end()]);
  }
  return results;
}

describeIntegration("idiomas: reglas en la base", () => {
  it("rechaza desactivar el idioma por defecto", async () => {
    await expect(
      database`update public.languages set is_active = false where code = 'es'`,
    ).rejects.toThrow(/languages_default_active_check/);
  });

  it("también lo rechaza a un admin con su sesión", async () => {
    const admin = await createTestUser(database, { role: "admin" });

    await expect(
      runAs(
        database,
        { kind: "signedIn", userId: admin.id },
        async (transaction) => {
          await transaction`update public.languages set is_active = false where code = 'es'`;
        },
      ),
    ).rejects.toThrow(/languages_default_active_check/);
  });

  it("deja desactivar y reactivar otro idioma", async () => {
    await database`update public.languages set is_active = false where code = 'en'`;
    await database`update public.languages set is_active = true where code = 'en'`;

    const [row] = await database<{ is_active: boolean }[]>`
      select is_active from public.languages where code = 'en'`;
    expect(row?.is_active).toBe(true);
  });
});

describeIntegration("mercados: el único activo", () => {
  it("rechaza desactivar el único mercado activo", async () => {
    await expect(deactivate(database, "CO")).rejects.toThrow(LAST_MARKET);

    expect(await listActiveCountries()).toEqual(["CO"]);
  });

  it("también lo rechaza a un admin con su sesión", async () => {
    const admin = await createTestUser(database, { role: "admin" });

    await expect(
      runAs(
        database,
        { kind: "signedIn", userId: admin.id },
        async (transaction) => {
          await deactivate(transaction, "CO");
        },
      ),
    ).rejects.toThrow(LAST_MARKET);
  });

  it("rechaza borrarlo, aun con la llave de servicio", async () => {
    await expect(
      database`delete from public.markets where country_code = 'CO'`,
    ).rejects.toThrow(LAST_MARKET);
  });

  it("deja desactivar uno si queda otro activo", async () => {
    await insertTestMarket();

    await deactivate(database, "CO");

    expect(await listActiveCountries()).toEqual([TEST_COUNTRY]);
  });

  it("rechaza desactivar todos en una sola sentencia", async () => {
    await insertTestMarket();

    await expect(
      database`update public.markets set is_active = false`,
    ).rejects.toThrow(LAST_MARKET);
    expect(await listActiveCountries()).toEqual(["CO", TEST_COUNTRY]);
  });

  it("dos desactivaciones simultáneas de los dos últimos dejan uno activo", async () => {
    await insertTestMarket();

    const [first, second] = await deactivateBothAtOnce(
      "isolation level read committed",
    );

    expect(first?.status).toBe("fulfilled");
    expect(second?.status).toBe("rejected");
    expect(String((second as PromiseRejectedResult).reason)).toMatch(
      LAST_MARKET,
    );
    expect(await listActiveCountries()).toEqual([TEST_COUNTRY]);
  });

  it("tampoco con aislamiento repetible quedan los dos apagados", async () => {
    await insertTestMarket();

    const results = await deactivateBothAtOnce(
      "isolation level repeatable read",
    );

    expect(results.map(({ status }) => status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(await listActiveCountries()).toEqual([TEST_COUNTRY]);
  });
});

describeIntegration("mercados: idioma y medios de pago", () => {
  it("rechaza como idioma por defecto uno desactivado", async () => {
    await insertInactiveLanguage();

    await expect(
      database`update public.markets set default_locale = ${TEST_LANGUAGE}
               where country_code = 'CO'`,
    ).rejects.toThrow(/markets_default_locale_active_check/);
  });

  it("rechaza crear un mercado con un idioma desactivado", async () => {
    await insertInactiveLanguage();

    await expect(
      database`insert into public.markets (country_code, currency, default_locale)
               values (${TEST_COUNTRY}, 'ZZZ', ${TEST_LANGUAGE})`,
    ).rejects.toThrow(/markets_default_locale_active_check/);
  });

  it("deja editar un mercado cuyo idioma se desactivó después, sin cambiarlo", async () => {
    await database`update public.markets set default_locale = 'en' where country_code = 'CO'`;
    await database`update public.languages set is_active = false where code = 'en'`;

    await database`
      update public.markets set ships_physical = true, default_locale = 'en'
      where country_code = 'CO'`;

    const [row] = await database<{ default_locale: string }[]>`
      select default_locale from public.markets where country_code = 'CO'`;
    expect(row?.default_locale).toBe("en");
  });

  it("acepta todos los medios de pago de la lista del sitio", async () => {
    await database`
      update public.markets set payment_methods = ${[...MARKET_PAYMENT_METHODS]}
      where country_code = 'CO'`;
  });

  it.each([["paypal"], ["card", "efectivo"], ["club_code"], [""]])(
    "rechaza medios de pago fuera de la lista: %s",
    async (...methods) => {
      await expect(
        database`update public.markets set payment_methods = ${methods}
                 where country_code = 'CO'`,
      ).rejects.toThrow(/markets_payment_methods_check/);
    },
  );
});
