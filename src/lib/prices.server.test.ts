import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { readItemPrices } from "./prices.server";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

const DATABASE_ERROR_STATUS = 500;
const MARKET_ID = "00000000-0000-4000-8000-000000000001";
const ITEM_ID = "00000000-0000-4000-8000-0000000000a1";
const TWELVE_THOUSAND_PESOS_IN_CENTS = 1_200_000;
const BEYOND_SAFE_INTEGER = 1e21;

function createClientAnswering(response: Response): TypedSupabaseClient {
  vi.stubGlobal("fetch", (): Promise<Response> => Promise.resolve(response));
  return createAnonSupabaseClient(buildTestServerEnv());
}

describe("precio de un ítem: base caída", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propaga el error de la base", async () => {
    const client = createClientAnswering(
      Response.json(
        { code: "XX000", message: "la base no responde" },
        { status: DATABASE_ERROR_STATUS },
      ),
    );

    await expect(readItemPrices([ITEM_ID], MARKET_ID, client)).rejects.toThrow(
      /la base no responde/,
    );
  });
});

describe("precio de un ítem: respuesta de la base", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve monto y moneda cuando hay precio", async () => {
    const client = createClientAnswering(
      Response.json([
        {
          catalog_item_id: ITEM_ID,
          amount: TWELVE_THOUSAND_PESOS_IN_CENTS,
          currency: "COP",
        },
      ]),
    );

    const prices = await readItemPrices([ITEM_ID], MARKET_ID, client);

    expect(prices.get(ITEM_ID)).toEqual({
      kind: "priced",
      price: { amount: TWELVE_THOUSAND_PESOS_IN_CENTS, currency: "COP" },
    });
  });

  it("devuelve 'sin precio' y no un cero cuando no hay fila", async () => {
    const client = createClientAnswering(Response.json([]));

    const prices = await readItemPrices([ITEM_ID], MARKET_ID, client);

    expect(prices.get(ITEM_ID)).toEqual({ kind: "unpriced" });
  });

  it("falla si el monto no es un entero seguro", async () => {
    const client = createClientAnswering(
      Response.json([
        {
          catalog_item_id: ITEM_ID,
          amount: BEYOND_SAFE_INTEGER,
          currency: "COP",
        },
      ]),
    );

    await expect(readItemPrices([ITEM_ID], MARKET_ID, client)).rejects.toThrow(
      /entero seguro/,
    );
  });

  it("falla si la moneda no es una que el sitio conoce", async () => {
    const client = createClientAnswering(
      Response.json([
        { catalog_item_id: ITEM_ID, amount: 100, currency: "EUR" },
      ]),
    );

    await expect(readItemPrices([ITEM_ID], MARKET_ID, client)).rejects.toThrow(
      /EUR/,
    );
  });

  it("devuelve un mapa vacío cuando no se piden ítems", async () => {
    const client = createClientAnswering(Response.json([]));

    const prices = await readItemPrices([], MARKET_ID, client);

    expect(prices.size).toBe(0);
  });
});
