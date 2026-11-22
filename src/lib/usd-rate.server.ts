import { readSetting, type SettingDefinition } from "./settings.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

// Pesos por dólar. Sin ajuste no hay tasa: el sitio muestra solo el peso.
const USD_REFERENCE_RATE: SettingDefinition<number | null> = {
  key: "usd_reference_rate",
  isValid: (value): value is number =>
    typeof value === "number" && Number.isFinite(value),
  fallback: null,
};

/** La tasa manual de pesos por dólar, o `null` si el admin no la ha escrito.
 * Un valor guardado que no es un número lanza `InvalidSettingError`. */
export function readUsdReferenceRate(
  client?: TypedSupabaseClient,
): Promise<number | null> {
  return readSetting(USD_REFERENCE_RATE, client);
}
