import { DEFAULT_LANGUAGE, type Language } from "./i18n/languages";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Una clave pedida no existe en ningún idioma. */
export class MissingSiteTextError extends Error {
  constructor(key: string) {
    super(
      `El texto editable "${key}" no existe en ningún idioma. Créalo en la tabla site_texts.`,
    );
    this.name = "MissingSiteTextError";
  }
}

interface SiteTextRow {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
}

function pickValue(
  rows: readonly SiteTextRow[],
  key: string,
  language: Language,
): string | undefined {
  return rows.find((row) => row.key === key && row.locale === language)?.value;
}

/**
 * Lee textos editables por clave, en una sola consulta, con el respaldo en
 * español: una versión vacía o de solo espacios cuenta como ausente.
 *
 * - Si una clave no existe en ningún idioma, lanza `MissingSiteTextError`.
 * - Si la base falla, lanza el error con las claves en el mensaje.
 *
 * Usa el cliente público: los textos son públicos. El tercer argumento existe
 * para las pruebas.
 */
export async function readSiteTexts(
  keys: readonly string[],
  language: Language,
  client: TypedSupabaseClient = createAnonSupabaseClient(),
): Promise<Readonly<Record<string, string>>> {
  const { data, error } = await client
    .from("site_texts")
    .select("key, locale, value")
    .in("key", [...keys])
    .in("locale", [language, DEFAULT_LANGUAGE]);

  if (error !== null) {
    throw new Error(
      `No se pudieron leer los textos editables (${keys.join(", ")}): ${error.message}`,
      { cause: error },
    );
  }

  const texts: Record<string, string> = {};
  for (const key of keys) {
    const requested = pickValue(data, key, language);
    const text =
      requested !== undefined && requested.trim() !== ""
        ? requested
        : pickValue(data, key, DEFAULT_LANGUAGE);
    if (text === undefined) {
      throw new MissingSiteTextError(key);
    }
    texts[key] = text;
  }
  return texts;
}
