import type { ReactElement } from "react";
import { Link } from "react-router";

import type { PageDeclaration } from "~/lib/i18n/page-path";
import { PAGES } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { getFooterColumns, type FooterColumn } from "~/lib/site-footer";
import type { MessageKey } from "~/lib/i18n/translate";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "~/lib/social-links";

import { LanguageSwitcher } from "./language-switcher";
import { TRANSITION_STYLES } from "./pressable-styles";
import { SocialIcon } from "./social-icons";

/** El ancla a la que salta el botón de menú sin JavaScript. */
export const FOOTER_ID = "pie";

const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

// 44 px de alto como mínimo: zona de toque en celular.
const LINK_STYLES = `inline-flex min-h-11 items-center text-[14px] font-bold no-underline hovered:text-brand-lime ${TRANSITION_STYLES}`;
const SOCIAL_LINK_STYLES = `inline-flex size-11 items-center justify-center rounded-pill text-brand-mist no-underline hovered:text-brand-lime ${TRANSITION_STYLES}`;

// Con la clave escrita completa, la prueba de textos ve que se usa.
const SOCIAL_LABEL_KEYS: Readonly<Record<SocialNetworkId, MessageKey>> = {
  tiktok: "footer.social.tiktok",
  instagram: "footer.social.instagram",
  youtube: "footer.social.youtube",
  facebook: "footer.social.facebook",
  whatsapp: "footer.social.whatsapp",
};

interface SiteFooterProps {
  /** El año de la línea legal, calculado en el servidor. */
  readonly year: number;
  /** Solo las pruebas la cambian: el sitio usa el mapa de páginas. */
  readonly pages?: readonly PageDeclaration[];
}

function FooterColumnLinks({
  column,
}: {
  readonly column: FooterColumn;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div>
      <h2 className="m-0 text-[14px] font-bold text-brand-lime">
        {translate(column.titleKey)}
      </h2>
      <ul className="m-0 list-none p-0">
        {column.links.map((link) => (
          <li key={link.id}>
            <Link to={link.href} className={LINK_STYLES}>
              {translate(link.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El pie de todas las páginas públicas: redes, enlaces, idioma y línea legal. */
export function SiteFooter({
  year,
  pages = PAGES,
}: SiteFooterProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const columns = getFooterColumns(pages, language);

  return (
    <footer
      id={FOOTER_ID}
      className="border-t-2 border-brand-red bg-brand-indigo text-brand-mist"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-10 md:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="flex flex-col gap-4">
            <img
              src="/brand/wordmark.png"
              alt=""
              width={WORDMARK_WIDTH}
              height={WORDMARK_HEIGHT}
              className="h-[30px] w-auto self-start"
            />
            <p className="m-0 font-display text-[20px] uppercase">
              {translate("footer.tagline")}
            </p>
            <ul
              aria-label={translate("footer.social.label")}
              className="m-0 flex list-none flex-wrap gap-2 p-0"
            >
              {SOCIAL_NETWORKS.map(({ id, href }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={translate(SOCIAL_LABEL_KEYS[id])}
                    className={SOCIAL_LINK_STYLES}
                  >
                    <SocialIcon network={id} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {columns.length === 0 ? null : (
            <nav
              aria-label={translate("footer.navLabel")}
              className="grid gap-6 sm:grid-cols-2 md:grid-cols-3"
            >
              {columns.map((column) => (
                <FooterColumnLinks key={column.id} column={column} />
              ))}
            </nav>
          )}
        </div>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="m-0 text-[14px]">
            {translate("footer.legalLine", { year })}
          </p>
          <LanguageSwitcher label={translate("footer.languageLabel")} />
        </div>
      </div>
    </footer>
  );
}
