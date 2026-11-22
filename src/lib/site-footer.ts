import type { Language } from "./i18n/languages";
import { buildPagePath, type PageDeclaration } from "./i18n/page-path";
import { findLanguage } from "./i18n/pages";
import type { MessageKey } from "./i18n/translate";

interface FooterLinkDefinition {
  /** El `id` que debe tener su página en el mapa de páginas. */
  readonly id: string;
  readonly labelKey: MessageKey;
}

// El orden de FR-003. Es la lista completa: un enlace se pinta cuando su
// página entra al mapa de páginas, así que cada ticket que crea una página
// solo le da el `id` de su enlace aquí.
export const FOOTER_LINKS = [
  { id: "tips", labelKey: "header.menu.tips" },
  { id: "camps", labelKey: "header.menu.camps" },
  { id: "vballTour", labelKey: "header.menu.vballTour" },
  { id: "shop", labelKey: "header.menu.shop" },
  { id: "app", labelKey: "header.menu.app" },
  { id: "about", labelKey: "header.menu.about" },
  { id: "contact", labelKey: "footer.link.contact" },
  { id: "faq", labelKey: "footer.link.faq" },
  { id: "myPurchases", labelKey: "footer.link.myPurchases" },
  { id: "terms", labelKey: "footer.link.terms" },
  { id: "privacy", labelKey: "footer.link.privacy" },
] as const satisfies readonly FooterLinkDefinition[];

type FooterLinkId = (typeof FOOTER_LINKS)[number]["id"];

interface FooterColumnDefinition {
  readonly id: string;
  readonly titleKey: MessageKey;
  readonly linkIds: readonly FooterLinkId[];
}

const FOOTER_COLUMNS: readonly FooterColumnDefinition[] = [
  {
    id: "explore",
    titleKey: "footer.column.explore",
    linkIds: ["tips", "camps", "vballTour", "shop", "app"],
  },
  {
    id: "volleytip",
    titleKey: "footer.column.volleytip",
    linkIds: ["about", "contact", "faq", "myPurchases"],
  },
  {
    id: "legal",
    titleKey: "footer.column.legal",
    linkIds: ["terms", "privacy"],
  },
];

export interface FooterLink extends FooterLinkDefinition {
  readonly href: string;
}

export interface FooterColumn {
  readonly id: string;
  readonly titleKey: MessageKey;
  readonly links: readonly FooterLink[];
}

/** Las columnas del pie con los enlaces cuya página existe. Una columna sin
 * enlaces no sale, y con ella su título. */
export function getFooterColumns(
  pages: readonly PageDeclaration[],
  language: Language,
): FooterColumn[] {
  const languageDefinition = findLanguage(language);
  const links = FOOTER_LINKS.flatMap((link) => {
    const page = pages.find((candidate) => candidate.id === link.id);
    return page === undefined
      ? []
      : [{ ...link, href: buildPagePath(page, languageDefinition) }];
  });
  return FOOTER_COLUMNS.map(({ id, titleKey, linkIds }) => ({
    id,
    titleKey,
    links: links.filter((link) => linkIds.includes(link.id)),
  })).filter((column) => column.links.length > 0);
}
