// Los medios de pago que un mercado puede ofrecer (FR-009): los de Wompi. Los
// otros valores del modelo de datos (`club_code`, `none`) describen cómo se
// pagó un pedido, no un medio que un mercado ofrezca. La base repite la lista
// en `markets_payment_methods_check`; una prueba de integración las compara.
export const MARKET_PAYMENT_METHODS = [
  "card",
  "pse",
  "nequi",
  "bancolombia_button",
] as const;

export type MarketPaymentMethod = (typeof MARKET_PAYMENT_METHODS)[number];

export function isMarketPaymentMethod(
  value: string,
): value is MarketPaymentMethod {
  return (MARKET_PAYMENT_METHODS as readonly string[]).includes(value);
}
