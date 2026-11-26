import { createContext } from "react-router";

import {
  ALL_LANGUAGES,
  listActiveLanguages,
  type ActiveLanguages,
} from "./i18n/active-languages";
import { giveUpAfter, SITE_SETTINGS_TIMEOUT_MS } from "./site-settings.server";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Lo que el middleware de la raíz lee una vez por petición. Sin él valen
 * todos: es lo que ven las direcciones que no consultan la base. */
export const activeLanguagesContext =
  createContext<ActiveLanguages>(ALL_LANGUAGES);

async function readActiveCodes(
  client: TypedSupabaseClient,
): Promise<readonly string[]> {
  const { data, error } = await client
    .from("languages")
    .select("code")
    .eq("is_active", true);
  if (error !== null) {
    throw new Error(`No se pudieron leer los idiomas: ${error.message}`, {
      cause: error,
    });
  }
  return data.map(({ code }) => code);
}

/**
 * Los idiomas activos del sitio, leídos en cada petición para que apagar uno
 * se note en la siguiente. Usa el cliente público: son datos públicos. Si la
 * base falla o no responde a tiempo, registra el error y sirve todos, como los
 * ajustes del sitio: un fallo de lectura no apaga páginas.
 */
export async function loadActiveLanguages(
  client: TypedSupabaseClient = createAnonSupabaseClient(),
): Promise<ActiveLanguages> {
  try {
    const codes = await giveUpAfter(
      SITE_SETTINGS_TIMEOUT_MS,
      readActiveCodes(client),
    );
    return listActiveLanguages(codes);
  } catch (error) {
    console.error("No se pudieron leer los idiomas activos", error);
    return ALL_LANGUAGES;
  }
}
