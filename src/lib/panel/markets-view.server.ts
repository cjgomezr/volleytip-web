import type {
  MarketsView,
  PanelLanguage,
  PanelMarket,
  UsdRateView,
} from "../admin/markets";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { USD_REFERENCE_RATE } from "../usd-rate.server";
import { readStoredSetting } from "./stored-setting.server";
import { isUsdRate } from "./usd-rate-editor.server";

/** Todos los idiomas, activos o no: con la sesión de un admin, RLS los deja
 * ver. El idioma por defecto va primero. */
export async function readPanelLanguages(
  client: TypedSupabaseClient,
): Promise<readonly PanelLanguage[]> {
  const { data, error } = await client
    .from("languages")
    .select("code, name, is_default, is_active")
    .order("is_default", { ascending: false })
    .order("code");
  if (error !== null) {
    throw new Error(`No se pudieron leer los idiomas: ${error.message}`, {
      cause: error,
    });
  }
  return data.map((row) => ({
    code: row.code,
    name: row.name,
    isDefault: row.is_default,
    isActive: row.is_active,
  }));
}

async function readPanelMarkets(
  client: TypedSupabaseClient,
): Promise<readonly PanelMarket[]> {
  const { data, error } = await client
    .from("markets")
    .select(
      "id, country_code, currency, default_locale, ships_physical, payment_methods, is_active",
    )
    .order("country_code");
  if (error !== null) {
    throw new Error(`No se pudieron leer los mercados: ${error.message}`, {
      cause: error,
    });
  }
  return data.map((row) => ({
    id: row.id,
    countryCode: row.country_code,
    currency: row.currency,
    defaultLocale: row.default_locale,
    shipsPhysical: row.ships_physical,
    paymentMethods: row.payment_methods,
    isActive: row.is_active,
  }));
}

async function readUsdRateView(
  client: TypedSupabaseClient,
): Promise<UsdRateView> {
  const stored = await readStoredSetting(USD_REFERENCE_RATE, client);
  if (stored.kind === "missing") return { state: "missing", value: "" };
  const { raw } = stored;
  const value = typeof raw === "string" ? raw : JSON.stringify(raw);
  return { state: isUsdRate(raw) ? "set" : "invalid", value };
}

/** Lo que pinta "Idiomas y mercados", leído con la sesión de la persona. */
export async function readMarketsView(
  client: TypedSupabaseClient,
): Promise<MarketsView> {
  const [languages, markets, usdRate] = await Promise.all([
    readPanelLanguages(client),
    readPanelMarkets(client),
    readUsdRateView(client),
  ]);
  return { languages, markets, usdRate };
}
