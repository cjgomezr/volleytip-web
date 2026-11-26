import {
  DEFAULT_LANGUAGE,
  getLanguageFromPath,
  SUPPORTED_LANGUAGES,
  type Language,
} from "./languages";
import { isPanelPath } from "./panel-pages";

// El código decide qué idiomas puede servir el sitio (`languages.ts`) y el
// admin, cuáles de ellos están activos (FR-065). El panel no cambia con eso:
// sigue en todos.

export type ActiveLanguages = readonly Language[];

export const ALL_LANGUAGES: ActiveLanguages = SUPPORTED_LANGUAGES.map(
  ({ code }) => code,
);

/** Los idiomas que el sitio sirve, dados los códigos activos en la base. El
 * idioma por defecto se sirve siempre. */
export function listActiveLanguages(
  activeCodes: readonly string[],
): ActiveLanguages {
  return ALL_LANGUAGES.filter(
    (code) => code === DEFAULT_LANGUAGE || activeCodes.includes(code),
  );
}

/** Si la dirección es de una página del sitio en un idioma desactivado. */
export function isInactiveLanguagePath(
  pathname: string,
  activeLanguages: ActiveLanguages,
): boolean {
  return (
    !isPanelPath(pathname) &&
    !activeLanguages.includes(getLanguageFromPath(pathname))
  );
}

/** El idioma en que se pinta una dirección. La de un idioma desactivado sigue
 * la regla de un prefijo que el sitio no sirve: el idioma por defecto. */
export function getServedLanguage(
  pathname: string,
  activeLanguages: ActiveLanguages,
): Language {
  return isInactiveLanguagePath(pathname, activeLanguages)
    ? DEFAULT_LANGUAGE
    : getLanguageFromPath(pathname);
}
