import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Cómo se lee un ajuste: su clave, la forma que debe tener su valor y qué
 * devolver cuando la clave todavía no existe. */
export interface SettingDefinition<Value> {
  readonly key: string;
  readonly isValid: (value: unknown) => value is Value;
  readonly fallback: Value;
}

/** El valor guardado de un ajuste no tiene la forma que el código espera. */
export class InvalidSettingError extends Error {
  constructor(key: string) {
    super(
      `El ajuste "${key}" tiene un valor guardado que no cumple la forma esperada. Corrígelo en la tabla settings.`,
    );
    this.name = "InvalidSettingError";
  }
}

/**
 * Lee un ajuste de la tabla `settings` y lo devuelve tipado.
 *
 * - Si la clave no existe, devuelve `fallback`.
 * - Si existe pero su valor no cumple `isValid`, lanza `InvalidSettingError`.
 *   No cae al valor por defecto: un ajuste mal guardado tiene que verse.
 * - Si la base falla, lanza el error con la clave en el mensaje.
 *
 * Usa la llave de servicio porque el sitio público necesita ajustes (modo
 * mantenimiento, barra de anuncios) que RLS solo muestra al admin. El
 * segundo argumento existe para las pruebas.
 */
export async function readSetting<Value>(
  definition: SettingDefinition<Value>,
  client: TypedSupabaseClient = createServiceSupabaseClient(),
): Promise<Value> {
  const { key, isValid, fallback } = definition;
  const { data, error } = await client
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`No se pudo leer el ajuste "${key}": ${error.message}`, {
      cause: error,
    });
  }
  if (data === null) {
    return fallback;
  }

  const value: unknown = data.value;
  if (!isValid(value)) {
    throw new InvalidSettingError(key);
  }
  return value;
}
