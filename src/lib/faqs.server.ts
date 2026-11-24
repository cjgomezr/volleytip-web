import { DEFAULT_LANGUAGE, type Language } from "./i18n/languages";
import {
  MissingSpanishTranslationError,
  resolveTranslatedFields,
  type TranslationsByLanguage,
} from "./translation-fallback";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Una pregunta frecuente lista para pintar, con el idioma de cada campo
 * (el pedido o el español de respaldo) para el atributo `lang`. */
export interface Faq {
  readonly id: string;
  readonly question: string;
  readonly questionLanguage: Language;
  readonly answer: string;
  readonly answerLanguage: Language;
}

export interface ReadFaqsOptions {
  /** Cuántas preguntas devolver como máximo, para otra página que pida solo
   * las primeras. Sin límite devuelve todas las publicadas. */
  readonly limit?: number;
  /** Existe para las pruebas. */
  readonly client?: TypedSupabaseClient;
}

interface FaqFields {
  readonly question: string;
  readonly answer: string;
}

interface FaqRow {
  readonly id: string;
  readonly faq_translations: readonly {
    readonly locale: string;
    readonly question: string;
    readonly answer: string;
  }[];
}

function groupByLanguage(
  row: FaqRow,
  language: Language,
): TranslationsByLanguage<FaqFields> {
  const wanted = new Set<string>([language, DEFAULT_LANGUAGE]);
  return Object.fromEntries(
    row.faq_translations
      .filter(({ locale }) => wanted.has(locale))
      .map(({ locale, question, answer }) => [locale, { question, answer }]),
  );
}

function resolveFaq(row: FaqRow, language: Language): Faq | undefined {
  try {
    const { fields, languages } = resolveTranslatedFields<FaqFields>({
      requestedLanguage: language,
      translations: groupByLanguage(row, language),
    });
    return {
      id: row.id,
      question: fields.question,
      questionLanguage: languages.question,
      answer: fields.answer,
      answerLanguage: languages.answer,
    };
  } catch (error) {
    if (!(error instanceof MissingSpanishTranslationError)) throw error;
    // Una pregunta sin español no se puede respaldar: se omite y la página
    // sigue. El error queda en el registro para que alguien la complete.
    console.error(`La pregunta frecuente ${row.id} no tiene español.`, error);
    return undefined;
  }
}

/**
 * Lee las preguntas publicadas en el orden de `sort_order`, resueltas campo
 * por campo con el respaldo en español. Una sin español se omite. Si la base
 * falla, lanza. Usa el cliente público: RLS ya oculta lo que no está
 * publicado. El límite se aplica después de omitir, para devolver tantas
 * como se pidieron cuando las hay.
 */
export async function readFaqs(
  language: Language,
  { limit, client = createAnonSupabaseClient() }: ReadFaqsOptions = {},
): Promise<readonly Faq[]> {
  const { data, error } = await client
    .from("faqs")
    .select("id, faq_translations(locale, question, answer)")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error !== null) {
    throw new Error(
      `No se pudieron leer las preguntas frecuentes: ${error.message}`,
      { cause: error },
    );
  }

  const faqs = data
    .map((row) => resolveFaq(row, language))
    .filter((faq): faq is Faq => faq !== undefined);
  return limit === undefined ? faqs : faqs.slice(0, limit);
}
