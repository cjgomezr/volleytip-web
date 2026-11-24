import type { ReactElement } from "react";
import { Link, useLocation } from "react-router";

import { SUPPORTED_LANGUAGES } from "~/lib/i18n/languages";
import { findPageAtPath, type PageDeclaration } from "~/lib/i18n/page-path";
import { getPagePath, PAGES } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { getMenuEntries, type MenuEntry } from "~/lib/site-menu";

import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { TRANSITION_STYLES } from "./pressable-styles";

const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

// 44 px de alto: zona de toque mínima.
const MENU_LINK_STYLES = `inline-flex min-h-11 items-center px-3 text-[14px] font-bold no-underline hovered:text-brand-lime ${TRANSITION_STYLES}`;
const CURRENT_MENU_LINK_STYLES = "underline decoration-2 underline-offset-8";

interface SiteHeaderProps {
  /** Solo las pruebas la cambian: el sitio usa el mapa de páginas. */
  readonly pages?: readonly PageDeclaration[];
}

/** El header de todas las páginas públicas: logo, menú único e idioma. */
export function SiteHeader({ pages = PAGES }: SiteHeaderProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const { pathname } = useLocation();
  const currentId = findPageAtPath(pathname, pages, SUPPORTED_LANGUAGES)?.page
    .id;
  const entries = getMenuEntries(pages, language);

  function renderEntry(entry: MenuEntry): ReactElement {
    const isCurrent = entry.id === currentId;
    return (
      <li key={entry.id}>
        <Link
          to={entry.href}
          aria-current={isCurrent ? "page" : undefined}
          className={`${MENU_LINK_STYLES} ${isCurrent ? CURRENT_MENU_LINK_STYLES : ""}`}
        >
          {translate(entry.labelKey)}
        </Link>
      </li>
    );
  }

  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-4 py-5 md:gap-4 md:px-6">
      <Link
        to={getPagePath("home", language)}
        aria-label={translate("header.homeLink")}
        className="shrink-0"
      >
        <img
          src="/brand/wordmark.png"
          alt=""
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          className="h-[30px] w-auto"
        />
      </Link>
      {entries.length === 0 ? null : (
        <nav
          aria-label={translate("header.menuLabel")}
          className="hidden md:block"
        >
          <ul className="m-0 flex list-none gap-2 p-0">
            {entries.map(renderEntry)}
          </ul>
        </nav>
      )}
      <div className="flex items-center gap-3">
        <LanguageSwitcher isCompact />
        <MobileMenu pages={pages} />
      </div>
    </header>
  );
}
