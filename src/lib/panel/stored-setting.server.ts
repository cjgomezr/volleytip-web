import { isDeepStrictEqual } from "node:util";

import type { Json } from "../database.types";
import {
  readSettings,
  rawSetting,
  type SettingDefinition,
} from "../settings.server";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import type { AuditedChange } from "./admin-action.server";

/** Un ajuste tal como está en la base. A diferencia del sitio, el panel
 * necesita ver lo guardado aunque no cumpla la forma: es lo que se corrige y
 * lo que queda en la bitácora como "antes". */
export type StoredSetting<Value> =
  | { readonly kind: "missing" }
  | { readonly kind: "valid"; readonly value: Value; readonly raw: Json }
  | { readonly kind: "invalid"; readonly raw: Json };

function classify<Value>(
  definition: SettingDefinition<Value>,
  raw: unknown,
): StoredSetting<Value> {
  if (raw === undefined) return { kind: "missing" };
  // La columna es `jsonb`: lo que llega de ella siempre es JSON.
  const json = raw as Json;
  return definition.isValid(raw)
    ? { kind: "valid", value: raw, raw: json }
    : { kind: "invalid", raw: json };
}

/** Lee un ajuste sin lanzar por su forma. Un fallo de la base sí se lanza. */
export async function readStoredSetting<Value>(
  definition: SettingDefinition<Value>,
  client: TypedSupabaseClient,
): Promise<StoredSetting<Value>> {
  const { setting } = await readSettings(
    { setting: rawSetting(definition.key) },
    client,
  );
  return classify(definition, setting);
}

export interface SettingReplacement {
  readonly client: TypedSupabaseClient;
  readonly key: string;
  readonly previous: StoredSetting<unknown>;
  readonly value: NonNullable<Json>;
}

/**
 * Guarda un ajuste con la sesión de la persona, así que la base solo deja a un
 * admin. Devuelve lo que `defineAdminAction` registra, o `null` si ya estaba
 * así y no se escribió nada. Lanza si la base no lo guardó.
 *
 * Leer `previous` y escribir son dos consultas: con dos envíos casi a la vez,
 * el "antes" de la bitácora puede no ser lo que el segundo pisó. Se acepta
 * mientras los ajustes los cambie un equipo mínimo; cerrarlo pide una función
 * de Postgres que devuelva el valor anterior al escribir.
 */
export async function replaceSetting({
  client,
  key,
  previous,
  value,
}: SettingReplacement): Promise<AuditedChange<"value"> | null> {
  if (previous.kind !== "missing" && isDeepStrictEqual(previous.raw, value)) {
    return null;
  }
  const { data, error } = await client
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" })
    .select("key");
  if (error !== null || data.length === 0) {
    throw new Error(
      `No se pudo guardar el ajuste "${key}": ${error?.message ?? "la base no cambió ninguna fila"}`,
      { cause: error },
    );
  }
  return {
    entityId: null,
    entityKey: key,
    before: previous.kind === "missing" ? null : { value: previous.raw },
    after: { value },
  };
}
