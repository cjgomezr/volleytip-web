import { z } from "zod";

import type { Database } from "./database.types";
import { DEFAULT_LANGUAGE, type Language } from "./i18n/languages";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";
import {
  TIP_FUNDAMENTALS,
  TIP_LEVELS,
  TIP_ORIENTATIONS,
  TIP_PROMOS,
  type TipFundamental,
  type TipLevel,
  type TipOrientation,
  type TipPromo,
} from "./tips";
import {
  resolveTranslatedFields,
  type ResolvedFields,
} from "./translation-fallback";

export const TIPS_PAGE_SIZE = 20;

// El tope de filas que la API devuelve en una consulta.
const MAX_PAGE_SIZE = 1000;
// Mucho más allá de cualquier catálogo. Un comienzo mayor se recorta aquí
// porque la base rechaza los números que no le caben.
const MAX_OFFSET = 1_000_000;
// En caracteres (PRD de W4, sección 6). Una búsqueda sin recortar no cabe en la
// dirección con que se cuenta y la lectura fallaría.
const MAX_QUERY_LENGTH = 100;
// El mismo tope y la misma forma que exige la base (`tips_slug_check`): un
// slug que no los cumple no es de ningún tip, y uno enorme no cabe en una
// consulta.
const MAX_SLUG_LENGTH = 500;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Código con que la API rechaza un rango que empieza después de la última fila.
const RANGE_NOT_SATISFIABLE = "PGRST103";

export interface TipText {
  readonly title: string;
  readonly achievement: string | null;
  readonly keys: readonly string[];
  readonly commonError: string | null;
  readonly practice: string | null;
}

/** Un tip público listo para pintar, con el idioma del que salió cada texto
 * (el pedido o el español de respaldo) para el atributo `lang`. */
export interface Tip {
  readonly id: string;
  readonly slug: string;
  readonly bunnyVideoId: string;
  readonly orientation: TipOrientation;
  readonly durationSeconds: number;
  readonly thumbnailUrl: string;
  readonly fundamental: TipFundamental;
  readonly level: TipLevel;
  readonly tiktokUrl: string | null;
  /** Nulo si el tip no tiene promoción configurada. */
  readonly promo: TipPromo | null;
  readonly isFeatured: boolean;
  readonly publishedAt: string;
  readonly text: TipText;
  readonly textLanguages: ResolvedFields<TipText>["languages"];
}

export interface TipPage {
  readonly tips: readonly Tip[];
  /** Cuántos tips cumplen los filtros y la búsqueda, en todas las páginas. */
  readonly total: number;
}

export interface TipReadingOptions {
  /** Existe para las pruebas. */
  readonly client?: TypedSupabaseClient;
}

export interface TipFilters {
  /** Se busca como texto en el título, la frase de logro y las claves. */
  readonly query?: string;
  readonly fundamental?: TipFundamental;
  readonly level?: TipLevel;
}

export interface ListPublishedTipsOptions
  extends TipFilters, TipReadingOptions {
  readonly offset?: number;
  readonly limit?: number;
}

type SearchArguments =
  Database["public"]["Functions"]["search_public_tips"]["Args"];

const translationSchema = z
  .object({
    title: z.string(),
    achievement: z.string().nullable(),
    keys: z.array(z.string()),
    common_error: z.string().nullable(),
    practice: z.string().nullable(),
  })
  .transform(({ common_error: commonError, ...text }): TipText => {
    return { ...text, commonError };
  });

// Los tipos generados dan por nulas todas las columnas de una vista. La base
// garantiza que un publicado las tiene; aquí se comprueba.
const tipRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  bunny_video_id: z.string(),
  orientation: z.enum(TIP_ORIENTATIONS),
  duration_seconds: z.number(),
  thumbnail_url: z.string(),
  fundamental: z.enum(TIP_FUNDAMENTALS),
  level: z.enum(TIP_LEVELS),
  tiktok_url: z.string().nullable(),
  promo: z.object({ type: z.enum(TIP_PROMOS) }).nullable(),
  is_featured: z.boolean(),
  published_at: z.string(),
  translations: z.record(z.string(), translationSchema),
});

type TipRow = z.infer<typeof tipRowSchema>;

function parseTipRow(row: { readonly slug: string | null }): TipRow {
  const parsed = tipRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error(`El tip "${row.slug}" llegó incompleto de la base.`, {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/** Resuelve los textos campo por campo (FR-007). La vista ya deja fuera los
 * tips sin español, que no tienen respaldo. Si uno llegara, se omite y queda
 * en el registro. */
function toTip(row: TipRow, language: Language): Tip | null {
  if (row.translations[DEFAULT_LANGUAGE] === undefined) {
    console.error(`El tip "${row.slug}" no tiene textos en español.`);
    return null;
  }
  const { fields, languages } = resolveTranslatedFields<TipText>({
    requestedLanguage: language,
    translations: row.translations,
  });
  return {
    id: row.id,
    slug: row.slug,
    bunnyVideoId: row.bunny_video_id,
    orientation: row.orientation,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    fundamental: row.fundamental,
    level: row.level,
    tiktokUrl: row.tiktok_url,
    promo: row.promo?.type ?? null,
    isFeatured: row.is_featured,
    publishedAt: row.published_at,
    text: fields,
    textLanguages: languages,
  };
}

interface WholeNumberRange {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

/** Lleva a un entero válido un número que puede venir de la dirección. */
function toWholeNumber(
  value: number,
  { min, max, fallback }: WholeNumberRange,
): number {
  if (Number.isNaN(value) || value < min) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

/** Deja como texto buscable lo que puede venir de la dirección. La base
 * rechaza el carácter nulo, y el recorte es por caracteres enteros para no
 * partir un emoji. */
function cleanQuery(query: string): string {
  const text = query.replaceAll("\u0000", "").trim();
  return Array.from(text).slice(0, MAX_QUERY_LENGTH).join("");
}

function searchArguments(
  language: Language,
  { query, fundamental, level }: TipFilters,
): SearchArguments {
  return {
    p_locale: language,
    p_query: query === undefined ? undefined : cleanQuery(query),
    p_fundamental: fundamental,
    p_level: level,
  };
}

function listingError(error: { readonly message: string } | null): Error {
  const reason = error?.message ?? "la base no dijo cuántos hay";
  return new Error(`No se pudieron leer los tips: ${reason}`, { cause: error });
}

async function countTips(
  client: TypedSupabaseClient,
  language: Language,
  filters: TipFilters,
): Promise<number> {
  const { count, error } = await client.rpc(
    "search_public_tips",
    searchArguments(language, filters),
    { count: "exact", head: true },
  );
  if (error !== null || count === null) {
    throw listingError(error);
  }
  return count;
}

/**
 * Una página de los tips publicados, del más reciente al más antiguo, con los
 * filtros y la búsqueda que lleguen. La búsqueda la resuelve la base sobre los
 * textos del idioma pedido. Si la base falla, lanza.
 */
export async function listPublishedTips(
  language: Language,
  {
    offset = 0,
    limit = TIPS_PAGE_SIZE,
    client = createAnonSupabaseClient(),
    ...filters
  }: ListPublishedTipsOptions = {},
): Promise<TipPage> {
  const first = toWholeNumber(offset, {
    min: 0,
    max: MAX_OFFSET,
    fallback: 0,
  });
  const size = toWholeNumber(limit, {
    min: 1,
    max: MAX_PAGE_SIZE,
    fallback: TIPS_PAGE_SIZE,
  });
  const { data, count, error } = await client
    .rpc("search_public_tips", searchArguments(language, filters), {
      count: "exact",
    })
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(first, first + size - 1);

  if (error?.code === RANGE_NOT_SATISFIABLE) {
    return { tips: [], total: await countTips(client, language, filters) };
  }
  if (error !== null || count === null) {
    throw listingError(error);
  }
  const tips = data
    .map((row) => toTip(parseTipRow(row), language))
    .filter((tip) => tip !== null);
  return { tips, total: count };
}

/**
 * Un tip publicado por su dirección, o nulo si no existe o no es público
 * (borrador, retirado o programado). Si la base falla, lanza.
 */
export async function readTipBySlug(
  language: Language,
  slug: string,
  { client = createAnonSupabaseClient() }: TipReadingOptions = {},
): Promise<Tip | null> {
  if (slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    return null;
  }
  const { data, error } = await client
    .from("public_tips")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`No se pudo leer el tip "${slug}": ${error.message}`, {
      cause: error,
    });
  }
  return data === null ? null : toTip(parseTipRow(data), language);
}
