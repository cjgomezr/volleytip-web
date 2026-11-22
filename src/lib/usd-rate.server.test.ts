import { describe, expect, it } from "vitest";

import { InvalidSettingError } from "./settings.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";
import { readUsdReferenceRate } from "./usd-rate.server";

/** Un cliente que responde con la fila indicada (o ninguna) sin tocar la red. */
function clientWith(value: unknown): TypedSupabaseClient {
  const result = Promise.resolve({
    data: value === undefined ? null : { value },
    error: null,
  });
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => result,
  };
  return { from: () => query } as unknown as TypedSupabaseClient;
}

describe("tasa del dólar", () => {
  it("devuelve la tasa cuando el ajuste existe y es válido", async () => {
    await expect(readUsdReferenceRate(clientWith(4000))).resolves.toBe(4000);
  });

  it("devuelve null cuando el ajuste no existe", async () => {
    await expect(
      readUsdReferenceRate(clientWith(undefined)),
    ).resolves.toBeNull();
  });

  it.each(["4000", null, { rate: 4000 }, Number.NaN])(
    "lanza el error de ajuste inválido con %j",
    async (stored) => {
      await expect(
        readUsdReferenceRate(clientWith(stored)),
      ).rejects.toBeInstanceOf(InvalidSettingError);
    },
  );
});
