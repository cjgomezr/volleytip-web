import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Un mercado donde se vende, tal como lo necesita el servidor. */
export interface Market {
  readonly id: string;
  readonly countryCode: string;
  readonly currency: string;
  readonly defaultLocale: string;
  readonly shipsPhysical: boolean;
}

/** No hay ningún mercado activo: el sitio no sabría en qué moneda vender. */
export class NoActiveMarketsError extends Error {
  constructor() {
    super(
      "No hay ningún mercado activo en la tabla markets. Activa al menos uno (en la fase 1, Colombia).",
    );
    this.name = "NoActiveMarketsError";
  }
}

/**
 * Lee los mercados activos y los devuelve tipados.
 *
 * - Si la base falla, lanza el error con su mensaje.
 * - Si no hay ninguno activo, lanza `NoActiveMarketsError` en vez de devolver
 *   una lista vacía: sin mercado no hay moneda y todo lo demás sería ruido.
 *
 * Usa el cliente público: los mercados activos son públicos y RLS ya filtra
 * las filas inactivas. El argumento existe para las pruebas.
 */
export async function readActiveMarkets(
  client: TypedSupabaseClient = createAnonSupabaseClient(),
): Promise<readonly Market[]> {
  const { data, error } = await client
    .from("markets")
    .select("id, country_code, currency, default_locale, ships_physical")
    .eq("is_active", true)
    .order("country_code");

  if (error !== null) {
    throw new Error(
      `No se pudieron leer los mercados activos: ${error.message}`,
      { cause: error },
    );
  }
  if (data.length === 0) {
    throw new NoActiveMarketsError();
  }

  return data.map((row) => ({
    id: row.id,
    countryCode: row.country_code,
    currency: row.currency,
    defaultLocale: row.default_locale,
    shipsPhysical: row.ships_physical,
  }));
}
