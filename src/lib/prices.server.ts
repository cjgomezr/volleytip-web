import { isSupportedCurrency, type Money } from "./i18n/format";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** El precio de un ítem en un mercado. "Sin precio" es un caso propio: un
 * ítem sin precio nunca se confunde con uno gratis. */
export type ItemPrice =
  | { readonly kind: "priced"; readonly price: Money }
  | { readonly kind: "unpriced" };

const UNPRICED: ItemPrice = { kind: "unpriced" };

interface PriceRow {
  readonly catalog_item_id: string;
  readonly amount: number;
  readonly currency: string;
}

function toItemPrice(row: PriceRow): ItemPrice {
  // supabase-js entrega el bigint como número de JavaScript: por encima de
  // Number.MAX_SAFE_INTEGER (unos 90 billones de pesos) perdería precisión.
  if (!Number.isSafeInteger(row.amount)) {
    throw new Error(
      `El monto del ítem ${row.catalog_item_id} no es un entero seguro: ${row.amount}.`,
    );
  }
  if (!isSupportedCurrency(row.currency)) {
    throw new Error(
      `El ítem ${row.catalog_item_id} tiene una moneda desconocida: ${row.currency}.`,
    );
  }
  return {
    kind: "priced",
    price: { amount: row.amount, currency: row.currency },
  };
}

/**
 * Lee el precio de varios ítems en un mercado, en una sola consulta. Devuelve
 * una entrada por cada ítem pedido.
 *
 * Usa el cliente público: lo que un visitante no debe ver (ítems sin publicar,
 * mercados inactivos) lo oculta RLS, así que aparece como "sin precio". Si la
 * base falla, lanza el error.
 */
export async function readItemPrices(
  itemIds: readonly string[],
  marketId: string,
  client: TypedSupabaseClient = createAnonSupabaseClient(),
): Promise<ReadonlyMap<string, ItemPrice>> {
  const prices = new Map<string, ItemPrice>(
    itemIds.map((itemId) => [itemId, UNPRICED]),
  );
  if (itemIds.length === 0) {
    return prices;
  }

  const { data, error } = await client
    .from("prices")
    .select("catalog_item_id, amount, currency")
    .eq("market_id", marketId)
    .in("catalog_item_id", [...itemIds]);

  if (error !== null) {
    throw new Error(`No se pudieron leer los precios: ${error.message}`, {
      cause: error,
    });
  }
  for (const row of data) {
    prices.set(row.catalog_item_id, toItemPrice(row));
  }
  return prices;
}
