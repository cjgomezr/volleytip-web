import type { Language } from "./i18n/languages";
import { getPagePath } from "./i18n/pages";
import { buildTipsSearch, type TipsQuery } from "./tips-query";

/** El listado de tips con unos filtros, en un idioma. */
export function getTipsListPath(language: Language, query: TipsQuery): string {
  return `${getPagePath("tips", language)}${buildTipsSearch(query, language)}`;
}

// La página de un tip (#159) cuelga del listado. Cuando entre al mapa de
// páginas, esta dirección sale de ahí.
/** La página de un tip en un idioma. */
export function getTipPath(language: Language, slug: string): string {
  return `${getPagePath("tips", language)}/${encodeURIComponent(slug)}`;
}
