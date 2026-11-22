import type { Language } from "./i18n/languages";
import { buildPagePath, type PageDeclaration } from "./i18n/page-path";
import { findLanguage } from "./i18n/pages";
import type { MessageKey } from "./i18n/translate";

interface MenuEntryDefinition {
  /** El `id` que debe tener su página en el mapa de páginas. */
  readonly id: string;
  readonly labelKey: MessageKey;
}

// El orden de FR-002. Es la lista completa: una entrada se pinta cuando su
// página entra al mapa de páginas, así que agregar una página es solo darle
// el `id` de su entrada aquí.
export const MENU_ENTRIES = [
  { id: "tips", labelKey: "header.menu.tips" },
  { id: "camps", labelKey: "header.menu.camps" },
  { id: "vballTour", labelKey: "header.menu.vballTour" },
  { id: "shop", labelKey: "header.menu.shop" },
  { id: "app", labelKey: "header.menu.app" },
  { id: "about", labelKey: "header.menu.about" },
] as const satisfies readonly MenuEntryDefinition[];

export interface MenuEntry extends MenuEntryDefinition {
  readonly href: string;
}

/** Las entradas del menú cuya página existe, en el orden de FR-002. */
export function getMenuEntries(
  pages: readonly PageDeclaration[],
  language: Language,
): MenuEntry[] {
  const languageDefinition = findLanguage(language);
  return MENU_ENTRIES.flatMap((entry) => {
    const page = pages.find((candidate) => candidate.id === entry.id);
    return page === undefined
      ? []
      : [{ ...entry, href: buildPagePath(page, languageDefinition) }];
  });
}
