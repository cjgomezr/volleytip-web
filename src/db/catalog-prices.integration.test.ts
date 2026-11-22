import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { createClient } from "@supabase/supabase-js";

import type { Database as DatabaseTypes } from "~/lib/database.types";
import { readItemPrices } from "~/lib/prices.server";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  type Database,
  type Session,
  type Transaction,
  type UserRole,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

const ANONYMOUS: Session = { kind: "anonymous" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
// Países de prueba que no chocan con Colombia, el mercado real.
const TEST_COUNTRY = "QZ";
const OTHER_TEST_COUNTRY = "QY";
// Más que el tope de un integer de Postgres (unos 2.147 millones).
const ABOVE_INTEGER_LIMIT = 100_000_000_000;
const UNIT_PRICE = 100;

type ItemStatus = "draft" | "published" | "retired";
type ItemKind = "physical" | "digital" | "event_plan" | "bundle";

let database: Database;
const createdItemIds: string[] = [];
const createdMarketIds: string[] = [];

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterEach(async () => {
  await database`delete from public.catalog_items where id = any(${createdItemIds.splice(0)})`;
  await database`delete from public.markets where id = any(${createdMarketIds.splice(0)})`;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

async function insertItem(
  status: ItemStatus = "published",
  kind: ItemKind = "physical",
): Promise<string> {
  const [row] = await database<{ id: string }[]>`
    insert into public.catalog_items (kind, status) values (${kind}, ${status})
    returning id`;
  if (row === undefined) throw new Error("no se creó el ítem");
  createdItemIds.push(row.id);
  return row.id;
}

async function insertMarket(
  country: string,
  currency: string,
  isActive = false,
): Promise<string> {
  const [row] = await database<{ id: string }[]>`
    insert into public.markets (country_code, currency, default_locale, is_active)
    values (${country}, ${currency}, 'es', ${isActive}) returning id`;
  if (row === undefined) throw new Error("no se creó el mercado");
  createdMarketIds.push(row.id);
  return row.id;
}

async function insertPrice(
  itemId: string,
  marketId: string,
  amount: number,
  currency: string,
): Promise<void> {
  await database`
    insert into public.prices (catalog_item_id, market_id, amount, currency)
    values (${itemId}, ${marketId}, ${String(amount)}, ${currency})`;
}

// El único mercado activo. Las pruebas no crean mercados activos propios: otros
// archivos corren en paralelo y verían filas que no esperan.
async function readColombiaMarketId(): Promise<string> {
  const [row] = await database<{ id: string }[]>`
    select id from public.markets where country_code = 'CO'`;
  if (row === undefined) throw new Error("falta el mercado CO");
  return row.id;
}

function createLocalAnonClient(
  customFetch?: typeof fetch,
): ReturnType<typeof createClient<DatabaseTypes>> {
  return createClient<DatabaseTypes>(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_ANON_KEY ?? "",
    customFetch === undefined ? undefined : { global: { fetch: customFetch } },
  );
}

describeIntegration("catalog_items", () => {
  it("define los valores de item_kind y price_mode", async () => {
    const kinds = await database<{ v: string }[]>`
      select unnest(enum_range(null::public.item_kind))::text as v`;
    const modes = await database<{ v: string }[]>`
      select unnest(enum_range(null::public.price_mode))::text as v`;

    expect(kinds.map((row) => row.v)).toEqual([
      "physical",
      "digital",
      "event_plan",
      "bundle",
    ]);
    expect(modes.map((row) => row.v)).toEqual(["manual"]);
  });

  it("nace en borrador y con IVA 0", async () => {
    const [created] = await database<{ id: string }[]>`
      insert into public.catalog_items (kind) values ('digital') returning id`;
    const id = created?.id ?? "";
    createdItemIds.push(id);

    const [row] = await database<{ tax_rate_bp: number; status: string }[]>`
      select tax_rate_bp, status from public.catalog_items where id = ${id}`;

    expect(row).toEqual({ tax_rate_bp: 0, status: "draft" });
  });

  it.each([0, 1900, 10000])("acepta el IVA %i", async (rate) => {
    const id = await insertItem();

    await expect(
      database`update public.catalog_items set tax_rate_bp = ${rate} where id = ${id}`,
    ).resolves.toBeDefined();
  });

  it.each([-1, 10001])("rechaza el IVA %i", async (rate) => {
    const id = await insertItem();

    await expect(
      database`update public.catalog_items set tax_rate_bp = ${rate} where id = ${id}`,
    ).rejects.toThrow(/catalog_items_tax_rate_bp_check/);
  });

  it("tiene RLS activado y comentario de ámbito", async () => {
    const [row] = await database<{ rls: boolean; comment: string }[]>`
      select c.relrowsecurity as rls, obj_description(c.oid) as comment
      from pg_class c where c.oid = 'public.catalog_items'::regclass`;

    expect(row?.rls).toBe(true);
    expect(row?.comment).toMatch(/^scope: (shared|web)/);
  });
});

describeIntegration("prices", () => {
  it("rechaza un monto negativo", async () => {
    const item = await insertItem();
    const market = await insertMarket(TEST_COUNTRY, "USD");

    await expect(insertPrice(item, market, -1, "USD")).rejects.toThrow(
      /prices_amount_check/,
    );
  });

  it("acepta un monto de cero", async () => {
    const item = await insertItem();
    const market = await insertMarket(TEST_COUNTRY, "USD");

    await expect(insertPrice(item, market, 0, "USD")).resolves.toBeUndefined();
  });

  it("guarda un monto mayor que el tope de integer", async () => {
    const item = await insertItem();
    const market = await insertMarket(TEST_COUNTRY, "USD");

    await insertPrice(item, market, ABOVE_INTEGER_LIMIT, "USD");

    const [row] = await database<{ amount: string }[]>`
      select amount::text from public.prices where catalog_item_id = ${item}`;
    expect(row?.amount).toBe(String(ABOVE_INTEGER_LIMIT));
  });

  it("rechaza un segundo precio para el mismo ítem y mercado", async () => {
    const item = await insertItem();
    const market = await insertMarket(TEST_COUNTRY, "USD");
    await insertPrice(item, market, UNIT_PRICE, "USD");

    await expect(insertPrice(item, market, 200, "USD")).rejects.toThrow(
      /prices_pkey/,
    );
  });

  it("rechaza un precio en una moneda que no es la del mercado", async () => {
    const item = await insertItem();
    const market = await insertMarket(TEST_COUNTRY, "USD");

    await expect(insertPrice(item, market, UNIT_PRICE, "COP")).rejects.toThrow(
      /prices_market_currency_fkey/,
    );
  });

  it("rechaza cambiar la moneda de un mercado que ya tiene precios", async () => {
    const item = await insertItem();
    const market = await insertMarket(TEST_COUNTRY, "USD");
    await insertPrice(item, market, UNIT_PRICE, "USD");

    await expect(
      database`update public.markets set currency = 'EUR' where id = ${market}`,
    ).rejects.toThrow(/prices_market_currency_fkey/);
  });

  it("borra los precios cuando se borra el ítem", async () => {
    const item = await insertItem();
    const market = await insertMarket(TEST_COUNTRY, "USD");
    await insertPrice(item, market, UNIT_PRICE, "USD");

    await database`delete from public.catalog_items where id = ${item}`;

    const rows = await database`
      select 1 from public.prices where catalog_item_id = ${item}`;
    expect(rows).toHaveLength(0);
  });

  it("tiene RLS activado y comentario de ámbito", async () => {
    const [row] = await database<{ rls: boolean; comment: string }[]>`
      select c.relrowsecurity as rls, obj_description(c.oid) as comment
      from pg_class c where c.oid = 'public.prices'::regclass`;

    expect(row?.rls).toBe(true);
    expect(row?.comment).toMatch(/^scope: (shared|web)/);
  });
});

interface Scenario {
  readonly published: string;
  readonly draft: string;
  readonly retired: string;
  readonly activeMarket: string;
  readonly inactiveMarket: string;
}

async function seedScenario(): Promise<Scenario> {
  const published = await insertItem("published");
  const draft = await insertItem("draft");
  const retired = await insertItem("retired");
  const activeMarket = await readColombiaMarketId();
  const inactiveMarket = await insertMarket(OTHER_TEST_COUNTRY, "USD");
  for (const item of [published, draft, retired]) {
    await insertPrice(item, activeMarket, UNIT_PRICE, "COP");
  }
  await insertPrice(published, inactiveMarket, UNIT_PRICE, "USD");
  return { published, draft, retired, activeMarket, inactiveMarket };
}

function scenarioItemIds(scenario: Scenario): string[] {
  return [scenario.published, scenario.draft, scenario.retired];
}

describeIntegration("catalog_items y prices: permisos", () => {
  async function openSession(who: "anonymous" | UserRole): Promise<Session> {
    if (who === "anonymous") return ANONYMOUS;
    const user = await createTestUser(database, { role: who });
    return { kind: "signedIn", userId: user.id };
  }

  async function seeWhatIsVisible(
    session: Session,
    scenario: Scenario,
  ): Promise<{ items: string[]; prices: string[] }> {
    const ids = scenarioItemIds(scenario);
    return runAs(database, session, async (transaction) => {
      const items = await transaction<{ id: string }[]>`
        select id from public.catalog_items where id = any(${ids})`;
      const prices = await transaction<{ key: string }[]>`
        select catalog_item_id || ':' || market_id as key from public.prices
        where catalog_item_id = any(${ids})`;
      return {
        items: items.map((row) => row.id),
        prices: prices.map((row) => row.key),
      };
    });
  }

  for (const who of ["anonymous", "buyer"] as const) {
    it(`${who} ve solo el ítem publicado y su precio en mercados activos`, async () => {
      const scenario = await seedScenario();

      const seen = await seeWhatIsVisible(await openSession(who), scenario);

      expect(seen.items).toEqual([scenario.published]);
      expect(seen.prices).toEqual([
        `${scenario.published}:${scenario.activeMarket}`,
      ]);
    });
  }

  it("un admin ve todo", async () => {
    const scenario = await seedScenario();

    const seen = await seeWhatIsVisible(await openSession("admin"), scenario);

    expect(seen.items).toHaveLength(3);
    expect(seen.prices).toHaveLength(4);
  });

  const writes: readonly [string, (t: Transaction, s: Scenario) => unknown][] =
    [
      [
        "insertar ítem",
        (t) => t`insert into public.catalog_items (kind) values ('bundle')`,
      ],
      [
        "actualizar ítem",
        (t, s) =>
          t`update public.catalog_items set tax_rate_bp = 5 where id = ${s.published}`,
      ],
      [
        "borrar ítem",
        (t, s) => t`delete from public.catalog_items where id = ${s.published}`,
      ],
      [
        "insertar precio",
        (t, s) =>
          t`insert into public.prices (catalog_item_id, market_id, amount, currency)
            values (${s.draft}, ${s.inactiveMarket}, 1, 'USD')`,
      ],
      [
        "actualizar precio",
        (t, s) =>
          t`update public.prices set amount = 5 where catalog_item_id = ${s.published}`,
      ],
      [
        "borrar precio",
        (t, s) =>
          t`delete from public.prices where catalog_item_id = ${s.published}`,
      ],
    ];

  for (const who of ["anonymous", "buyer", "staff"] as const) {
    it.each(writes)(`${who} no puede %s`, async (name, attempt) => {
      const scenario = await seedScenario();
      const session = await openSession(who);
      const bundlesBefore = await database`
        select 1 from public.catalog_items where kind = 'bundle'`;

      // Sin permiso la base rechaza; con permiso pero sin política la
      // operación no toca ninguna fila. Ambas dejan los datos iguales.
      await runAs(database, session, async (transaction) => {
        await attempt(transaction, scenario);
      }).catch((error: unknown) => {
        if (!(
          error instanceof Error && PERMISSION_DENIED.test(error.message)
        )) {
          throw error;
        }
      });

      const ids = scenarioItemIds(scenario);
      const items = await database`
        select 1 from public.catalog_items
        where id = any(${ids}) and tax_rate_bp = 0`;
      const prices = await database`
        select 1 from public.prices
        where catalog_item_id = any(${ids}) and amount = ${UNIT_PRICE}`;
      const bundlesAfter = await database`
        select 1 from public.catalog_items where kind = 'bundle'`;
      expect(items, name).toHaveLength(3);
      expect(prices, name).toHaveLength(4);
      expect(bundlesAfter, name).toHaveLength(bundlesBefore.length);
    });
  }

  it("un admin inserta, actualiza y borra", async () => {
    const admin = await openSession("admin");
    const market = await insertMarket(TEST_COUNTRY, "USD");

    const id = await runAs(database, admin, async (transaction) => {
      const [item] = await transaction<{ id: string }[]>`
        insert into public.catalog_items (kind) values ('digital') returning id`;
      if (item === undefined) throw new Error("sin ítem");
      createdItemIds.push(item.id);
      await transaction`insert into public.prices (catalog_item_id, market_id, amount, currency)
                        values (${item.id}, ${market}, 100, 'USD')`;
      await transaction`update public.prices set amount = 200 where catalog_item_id = ${item.id}`;
      await transaction`update public.catalog_items set status = 'published' where id = ${item.id}`;
      return item.id;
    });
    const [row] = await database<{ amount: string }[]>`
      select amount::text from public.prices where catalog_item_id = ${id}`;
    expect(row?.amount).toBe("200");

    await runAs(database, admin, async (transaction) => {
      await transaction`delete from public.prices where catalog_item_id = ${id}`;
      await transaction`delete from public.catalog_items where id = ${id}`;
    });
    const left =
      await database`select 1 from public.catalog_items where id = ${id}`;
    expect(left).toHaveLength(0);
  });
});

describeIntegration("precio de un ítem", () => {
  it("devuelve monto y moneda, sin perder precisión por encima de integer", async () => {
    const item = await insertItem("published");
    const market = await readColombiaMarketId();
    await insertPrice(item, market, ABOVE_INTEGER_LIMIT, "COP");

    const prices = await readItemPrices(
      [item],
      market,
      createLocalAnonClient(),
    );

    expect(prices.get(item)).toEqual({
      kind: "priced",
      price: { amount: ABOVE_INTEGER_LIMIT, currency: "COP" },
    });
  });

  it("devuelve 'sin precio' para un ítem sin precio en ese mercado", async () => {
    const item = await insertItem("published");
    const market = await readColombiaMarketId();

    const prices = await readItemPrices(
      [item],
      market,
      createLocalAnonClient(),
    );

    expect(prices.get(item)).toEqual({ kind: "unpriced" });
  });

  it("devuelve 'sin precio' para un ítem en borrador", async () => {
    const item = await insertItem("draft");
    const market = await readColombiaMarketId();
    await insertPrice(item, market, UNIT_PRICE, "COP");

    const prices = await readItemPrices(
      [item],
      market,
      createLocalAnonClient(),
    );

    expect(prices.get(item)).toEqual({ kind: "unpriced" });
  });

  it("devuelve 'sin precio' en un mercado inactivo", async () => {
    const item = await insertItem("published");
    const market = await insertMarket(TEST_COUNTRY, "USD", false);
    await insertPrice(item, market, UNIT_PRICE, "USD");

    const prices = await readItemPrices(
      [item],
      market,
      createLocalAnonClient(),
    );

    expect(prices.get(item)).toEqual({ kind: "unpriced" });
  });

  it("lee varios ítems en una sola consulta", async () => {
    const first = await insertItem("published");
    const second = await insertItem("published");
    const market = await readColombiaMarketId();
    await insertPrice(first, market, UNIT_PRICE, "COP");
    const requests: string[] = [];
    const countingFetch: typeof fetch = (input, init) => {
      requests.push(String(input));
      return fetch(input, init);
    };

    const prices = await readItemPrices(
      [first, second],
      market,
      createLocalAnonClient(countingFetch),
    );

    expect(requests).toHaveLength(1);
    expect(prices.get(first)?.kind).toBe("priced");
    expect(prices.get(second)).toEqual({ kind: "unpriced" });
  });
});
