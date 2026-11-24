import type { Language } from "./i18n/languages";
import { buildPagePath, type PageDeclaration } from "./i18n/page-path";
import { findLanguage } from "./i18n/pages";

/** El parámetro de la dirección de Contacto que trae el motivo ya elegido
 * (`/contacto?motivo=marcas`). Lo comparten quien enlaza y la página de
 * Contacto. */
export const CONTACT_REASON_PARAM = "motivo";
/** El motivo "Marcas y colaboraciones". */
export const CONTACT_REASON_BRANDS = "marcas";

const CONTACT_PAGE_ID = "contact";

/**
 * La dirección de Contacto con un motivo elegido, o `undefined` mientras
 * Contacto no esté en el mapa de páginas: quien enlaza no pinta el botón.
 */
export function getContactHref(
  pages: readonly PageDeclaration[],
  language: Language,
  reason: string,
): string | undefined {
  const page = pages.find((candidate) => candidate.id === CONTACT_PAGE_ID);
  if (page === undefined) {
    return undefined;
  }
  const path = buildPagePath(page, findLanguage(language));
  return `${path}?${new URLSearchParams({ [CONTACT_REASON_PARAM]: reason }).toString()}`;
}
