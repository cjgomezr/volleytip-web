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

/** Un ajuste leído sin comprobar su forma, para quien la comprueba después.
 * Sin fila, su valor es `undefined`. */
export function rawSetting(key: string): SettingDefinition<unknown> {
  return {
    key,
    // Acepta cualquier valor.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isValid: (_value): _value is unknown => true,
    fallback: undefined,
  };
}

type SettingDefinitions = Readonly<Record<string, SettingDefinition<unknown>>>;

/** Los valores leídos, con la misma forma que las definiciones pedidas. */
type SettingValues<Definitions extends SettingDefinitions> = {
  readonly [
    Name in keyof Definitions
  ]: Definitions[Name] extends SettingDefinition<infer Value> ? Value : never;
};

function resolveSetting<Value>(
  definition: SettingDefinition<Value>,
  rows: readonly { key: string; value: unknown }[],
): Value {
  const row = rows.find(({ key }) => key === definition.key);
  if (row === undefined) {
    return definition.fallback;
  }
  if (!definition.isValid(row.value)) {
    throw new InvalidSettingError(definition.key);
  }
  return row.value;
}

/**
 * Lee varios ajustes de la tabla `settings` en una sola consulta y los
 * devuelve tipados, con el nombre que cada definición tiene en `definitions`.
 *
 * - Si una clave no existe, esa entrada es su `fallback`.
 * - Si existe pero su valor no cumple `isValid`, lanza `InvalidSettingError`.
 *   No cae al valor por defecto: un ajuste mal guardado tiene que verse.
 * - Si la base falla, lanza el error con las claves en el mensaje.
 *
 * Usa la llave de servicio porque el sitio público necesita ajustes (modo
 * mantenimiento, barra de anuncios) que RLS solo muestra al admin. El
 * segundo argumento existe para las pruebas.
 */
export async function readSettings<Definitions extends SettingDefinitions>(
  definitions: Definitions,
  client: TypedSupabaseClient = createServiceSupabaseClient(),
): Promise<SettingValues<Definitions>> {
  const entries = Object.entries(definitions);
  const keys = entries.map(([, { key }]) => key);
  const { data, error } = await client
    .from("settings")
    .select("key, value")
    .in("key", keys);

  if (error !== null) {
    throw new Error(
      `No se pudo leer el ajuste "${keys.join(", ")}": ${error.message}`,
      { cause: error },
    );
  }

  // `Object.fromEntries` pierde las claves: cada valor sale de la definición
  // con su nombre, y `SettingValues` las vuelve a tipar.
  return Object.fromEntries(
    entries.map(([name, definition]) => [
      name,
      resolveSetting(definition, data),
    ]),
  ) as SettingValues<Definitions>;
}

/** Lee un solo ajuste, con una consulta por clave. Mismas reglas que
 * `readSettings`. */
export async function readSetting<Value>(
  definition: SettingDefinition<Value>,
  client: TypedSupabaseClient = createServiceSupabaseClient(),
): Promise<Value> {
  const { key } = definition;
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
  return resolveSetting(
    definition,
    data === null ? [] : [{ key, value: data.value }],
  );
}
