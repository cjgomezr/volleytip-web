import { describe, expect, it } from "vitest";

import { calculateUsdApproximation } from "./usd-approximation";

const COP_PER_USD = 4000;

function cop(pesos: number): { amount: number; currency: "COP" } {
  return { amount: pesos * 100, currency: "COP" };
}

describe("aproximado en dólares", () => {
  it("da 12 dólares para $48.000 a 4000 pesos por dólar", () => {
    expect(calculateUsdApproximation(cop(48_000), COP_PER_USD)).toEqual({
      kind: "approximate",
      dollars: 12,
    });
  });

  it("redondea hacia abajo por debajo de la mitad", () => {
    expect(calculateUsdApproximation(cop(49_000), COP_PER_USD)).toEqual({
      kind: "approximate",
      dollars: 12,
    });
  });

  it("redondea hacia arriba desde la mitad", () => {
    expect(calculateUsdApproximation(cop(50_000), COP_PER_USD)).toEqual({
      kind: "approximate",
      dollars: 13,
    });
  });

  it("dice menos de un dólar cuando el resultado es menor que uno", () => {
    expect(calculateUsdApproximation(cop(3_999), COP_PER_USD)).toEqual({
      kind: "lessThanOneDollar",
    });
  });

  it("un dólar exacto es un dólar", () => {
    expect(calculateUsdApproximation(cop(4_000), COP_PER_USD)).toEqual({
      kind: "approximate",
      dollars: 1,
    });
  });

  it("calcula un monto grande sin perder precisión", () => {
    expect(calculateUsdApproximation(cop(4_000_000_000), COP_PER_USD)).toEqual({
      kind: "approximate",
      dollars: 1_000_000,
    });
  });
});

describe("aproximado en dólares: sin aproximado", () => {
  const NONE = { kind: "none" };

  it("no hay aproximado para un precio de $0", () => {
    expect(calculateUsdApproximation(cop(0), COP_PER_USD)).toEqual(NONE);
  });

  it("no hay aproximado sin tasa", () => {
    expect(calculateUsdApproximation(cop(48_000), null)).toEqual(NONE);
  });

  it("no hay aproximado con tasa cero", () => {
    expect(calculateUsdApproximation(cop(48_000), 0)).toEqual(NONE);
  });

  it("no hay aproximado con tasa negativa", () => {
    expect(calculateUsdApproximation(cop(48_000), -4000)).toEqual(NONE);
  });

  it("no hay aproximado si el precio no está en COP", () => {
    expect(
      calculateUsdApproximation({ amount: 4800, currency: "USD" }, COP_PER_USD),
    ).toEqual(NONE);
  });
});
