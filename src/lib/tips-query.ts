// Los filtros, la búsqueda y la página del listado de tips, como viajan en la
// dirección. Los nombres y los valores van en el idioma de la página
// (decisión 11 del PRD de W4). El navegador también carga este archivo.

import type { Language } from "./i18n/languages";
import {
  TIP_FUNDAMENTALS,
  TIP_LEVELS,
  type TipFundamental,
  type TipLevel,
} from "./tips";

/** En caracteres (PRD de W4, sección 6). */
export const MAX_TIP_QUERY_LENGTH = 100;

export interface TipsQuery {
  readonly fundamental?: TipFundamental;
  readonly level?: TipLevel;
  /** Vacía cuando no hay búsqueda. */
  readonly query: string;
  /** Desde 1. */
  readonly page: number;
}

interface ParameterNames {
  readonly fundamental: string;
  readonly level: string;
  readonly query: string;
  readonly page: string;
}

export const TIPS_PARAMETERS: Readonly<Record<Language, ParameterNames>> = {
  es: {
    fundamental: "fundamento",
    level: "nivel",
    query: "buscar",
    page: "pagina",
  },
  en: { fundamental: "skill", level: "level", query: "search", page: "page" },
};

/** Marca el pedido con que el navegador trae más tips. No va en ningún
 * enlace. */
export const LOAD_MORE_PARAMETER = "cargar-mas";

export const TIP_FUNDAMENTAL_VALUES: Readonly<
  Record<Language, Readonly<Record<TipFundamental, string>>>
> = {
  es: {
    serve: "saque",
    reception: "recepcion",
    setting: "colocacion",
    attack: "ataque",
    block: "bloqueo",
    defense: "defensa",
  },
  en: {
    serve: "serve",
    reception: "reception",
    setting: "setting",
    attack: "attack",
    block: "block",
    defense: "defense",
  },
};

export const TIP_LEVEL_VALUES: Readonly<
  Record<Language, Readonly<Record<TipLevel, string>>>
> = {
  es: { basic: "basico", intermediate: "intermedio", advanced: "avanzado" },
  en: { basic: "basic", intermediate: "intermediate", advanced: "advanced" },
};

// Solo dígitos y sin ceros a la izquierda.
const PAGE_PATTERN = /^[1-9]\d{0,8}$/;

/** Deja como texto buscable lo que puede venir de la dirección. La base
 * rechaza el carácter nulo, y el recorte es por caracteres enteros para no
 * partir un emoji. */
export function cleanTipQuery(text: string): string {
  const trimmed = text.replaceAll("\u0000", "").trim();
  return Array.from(trimmed).slice(0, MAX_TIP_QUERY_LENGTH).join("").trim();
}

function parsePage(text: string | null): number {
  return text !== null && PAGE_PATTERN.test(text) ? Number(text) : 1;
}

/** Lo que pide la dirección. Un valor que no existe se ignora. */
export function parseTipsQuery(
  params: URLSearchParams,
  language: Language,
): TipsQuery {
  const names = TIPS_PARAMETERS[language];
  const fundamentalValue = params.get(names.fundamental);
  const levelValue = params.get(names.level);
  const fundamental = TIP_FUNDAMENTALS.find(
    (id) => TIP_FUNDAMENTAL_VALUES[language][id] === fundamentalValue,
  );
  const level = TIP_LEVELS.find(
    (id) => TIP_LEVEL_VALUES[language][id] === levelValue,
  );
  return {
    ...(fundamental === undefined ? {} : { fundamental }),
    ...(level === undefined ? {} : { level }),
    query: cleanTipQuery(params.get(names.query) ?? ""),
    page: parsePage(params.get(names.page)),
  };
}

/** Los parámetros de un pedido, sin los que quedan en su valor inicial. */
function toEntries(
  { fundamental, level, query, page }: TipsQuery,
  language: Language,
): [string, string][] {
  const names = TIPS_PARAMETERS[language];
  const entries: [string, string | undefined][] = [
    [
      names.fundamental,
      fundamental && TIP_FUNDAMENTAL_VALUES[language][fundamental],
    ],
    [names.level, level && TIP_LEVEL_VALUES[language][level]],
    [names.query, query || undefined],
    [names.page, page > 1 ? String(page) : undefined],
  ];
  return entries.filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
}

function toSearch(params: URLSearchParams): string {
  const search = params.toString();
  return search === "" ? "" : `?${search}`;
}

/** La cadena de búsqueda de un pedido, con su `?`, o "" si no hay nada. */
export function buildTipsSearch(query: TipsQuery, language: Language): string {
  return toSearch(new URLSearchParams(toEntries(query, language)));
}

/** El listado filtrado puede venir sin nada que quitar. La página no cuenta
 * como filtro. */
export function hasTipFilters({
  fundamental,
  level,
  query,
}: TipsQuery): boolean {
  return fundamental !== undefined || level !== undefined || query !== "";
}

/**
 * La misma búsqueda con los nombres y valores de otro idioma. Lo que no es del
 * listado (una marca de campaña) se conserva.
 */
export function translateTipsSearch(
  search: string,
  from: Language,
  to: Language,
): string {
  if (from === to) return search;
  const params = new URLSearchParams(search);
  const translated = toEntries(parseTipsQuery(params, from), to);
  const ownNames = new Set([
    LOAD_MORE_PARAMETER,
    ...[from, to].flatMap((language) =>
      Object.values(TIPS_PARAMETERS[language]),
    ),
  ]);
  const others = [...params].filter(([name]) => !ownNames.has(name));
  return toSearch(new URLSearchParams([...translated, ...others]));
}
