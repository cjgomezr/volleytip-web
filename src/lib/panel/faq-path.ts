import { SUPPORTED_LANGUAGES } from "../i18n/languages";
import { findPageAtPath } from "../i18n/page-path";
import { PANEL_PAGES, type PanelPageId } from "../i18n/panel-pages";

const FAQ_PAGES: readonly PanelPageId[] = [
  "adminFaqs",
  "adminFaqNew",
  "adminFaq",
  "adminFaqPublish",
  "adminFaqRetire",
  "adminFaqMove",
];

/** Dice si la dirección es de las preguntas frecuentes del panel, en
 * cualquier idioma. */
export function isFaqPath(pathname: string): boolean {
  const match = findPageAtPath(pathname, PANEL_PAGES, SUPPORTED_LANGUAGES);
  return (
    match !== undefined && FAQ_PAGES.includes(match.page.id as PanelPageId)
  );
}
