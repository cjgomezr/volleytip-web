import type { Money } from "./i18n/format";

/** Lo que se muestra debajo de un precio en pesos. "Sin aproximado" es un
 * caso propio: el precio en pesos se muestra igual. */
export type UsdApproximation =
  | { readonly kind: "approximate"; readonly dollars: number }
  | { readonly kind: "lessThanOneDollar" }
  | { readonly kind: "none" };

const NO_APPROXIMATION: UsdApproximation = { kind: "none" };
// DR-001: el monto guardado va en centavos, también el peso.
const CENTS_PER_PESO = 100;

/**
 * Aproxima en dólares un precio en pesos con la tasa manual (pesos por dólar).
 * Parte del entero en centavos y redondea una sola vez, al dólar entero más
 * cercano. Si el resultado es menor que un dólar, lo dice así en vez de
 * mostrar cero.
 */
export function calculateUsdApproximation(
  price: Money,
  copPerUsd: number | null,
): UsdApproximation {
  if (price.currency !== "COP" || price.amount <= 0) return NO_APPROXIMATION;
  if (copPerUsd === null || !Number.isFinite(copPerUsd) || copPerUsd <= 0) {
    return NO_APPROXIMATION;
  }
  const exactDollars = price.amount / (copPerUsd * CENTS_PER_PESO);
  if (exactDollars < 1) return { kind: "lessThanOneDollar" };
  return { kind: "approximate", dollars: Math.round(exactDollars) };
}
