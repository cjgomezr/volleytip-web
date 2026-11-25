import { SUPPORTED_LANGUAGES, type Language } from "../i18n/languages";
import {
  buildPagePath,
  findPageAtPath,
  type PageDeclaration,
} from "../i18n/page-path";
import { findLanguage } from "../i18n/pages";

// Solo sirve para que `URL` interprete una dirección relativa y para
// comprobar que no apunta a otro sitio.
const PARSING_ORIGIN = "http://internal.invalid";

interface PathOptions {
  /** Las pantallas a las que se puede volver. */
  readonly pages: readonly PageDeclaration[];
  /** A dónde se va si lo pedido no es ninguna de ellas. */
  readonly fallback: string;
}

/**
 * La misma pantalla en otro idioma, con su búsqueda. `requested` llega del
 * navegador: nunca se redirige a ello, solo se usa para reconocer la pantalla
 * y la dirección se arma con su declaración.
 */
export function getPanelPathInLanguage(
  requested: string,
  language: Language,
  { pages, fallback }: PathOptions,
): string {
  if (!requested.startsWith("/")) return fallback;
  const url = new URL(requested, PARSING_ORIGIN);
  if (url.origin !== PARSING_ORIGIN) return fallback;
  const match = findPageAtPath(url.pathname, pages, SUPPORTED_LANGUAGES);
  if (match === undefined) return fallback;
  const path = buildPagePath(match.page, findLanguage(language), match.params);
  return `${path}${url.search}`;
}
