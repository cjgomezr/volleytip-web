import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { NoActiveMarketsError, readActiveMarkets } from "./markets.server";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

const DATABASE_ERROR_STATUS = 500;

function createClientAnswering(response: Response): TypedSupabaseClient {
  vi.stubGlobal("fetch", (): Promise<Response> => Promise.resolve(response));
  return createAnonSupabaseClient(buildTestServerEnv());
}

describe("mercados activos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve una lista tipada con los campos en camelCase", async () => {
    const client = createClientAnswering(
      Response.json([
        {
          id: "00000000-0000-4000-8000-000000000001",
          country_code: "CO",
          currency: "COP",
          default_locale: "es",
          ships_physical: true,
          payment_methods: [],
          is_active: true,
        },
      ]),
    );

    const markets = await readActiveMarkets(client);

    expect(markets).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        countryCode: "CO",
        currency: "COP",
        defaultLocale: "es",
        shipsPhysical: true,
      },
    ]);
  });

  it("lanza un error claro cuando no hay ningún mercado activo", async () => {
    const client = createClientAnswering(Response.json([]));

    await expect(readActiveMarkets(client)).rejects.toThrow(
      NoActiveMarketsError,
    );
  });

  it("propaga el error cuando la base falla", async () => {
    const client = createClientAnswering(
      Response.json(
        { code: "XX000", message: "la base no responde" },
        { status: DATABASE_ERROR_STATUS },
      ),
    );

    await expect(readActiveMarkets(client)).rejects.toThrow(
      /No se pudieron leer los mercados activos: la base no responde/,
    );
  });
});
