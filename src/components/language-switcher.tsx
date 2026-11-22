import type { MouseEvent, ReactElement } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type Language,
} from "~/lib/i18n/languages";
import { getPagePath, type CurrentPage } from "~/lib/i18n/pages";
import {
  isPlainLeftClick,
  saveLanguageChoice,
} from "~/lib/i18n/save-language-choice";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useCurrentPage } from "~/lib/i18n/use-current-page";
import { useLanguage } from "~/lib/i18n/use-language";

import type { Zone } from "./pressable";
import { TRANSITION_STYLES } from "./pressable-styles";

interface LanguageSwitcherProps {
  readonly zone?: Zone;
  /** Muestra el código ("ES") en vez del nombre. Es la forma del header,
   * donde el nombre completo no cabe junto al logo a 360 px. El lector de
   * pantalla sigue oyendo el nombre. */
  readonly isCompact?: boolean;
  /** El nombre accesible de la navegación. Cada una de la página necesita el
   * suyo: el pie no puede repetir el del header. */
  readonly label?: string;
}

const FALLBACK_PAGE: CurrentPage = { page: "home", params: {} };

const LIST_STYLES =
  "inline-flex list-none items-stretch rounded-pill border-2 p-0";

const LIST_ZONE_STYLES: Record<Zone, string> = {
  dark: "border-brand-mist",
  light: "border-brand-night",
};

// 44 px de alto: es la zona de toque mínima en celular.
const LINK_STYLES =
  "inline-flex min-h-11 items-center rounded-pill text-[14px] font-bold no-underline";
const FULL_PADDING = "px-4";
// 44 px de ancho como mínimo: el código es corto y la zona de toque no.
const COMPACT_PADDING = "min-w-11 justify-center px-3";

const CURRENT_STYLES: Record<Zone, string> = {
  dark: "bg-brand-mist text-brand-night",
  light: "bg-brand-night text-brand-mist focused:outline-brand-night",
};

// El mismo hover que los enlaces de los mockups: lima en zona oscura,
// subrayado en zona clara, donde la lima no contrasta.
const OTHER_STYLES: Record<Zone, string> = {
  dark: "text-brand-mist hovered:text-brand-lime pressed:text-brand-lime",
  light:
    "text-brand-night hovered:underline pressed:underline focused:outline-brand-night",
};

/**
 * Un enlace por idioma hacia la misma página en ese idioma, con los
 * parámetros de búsqueda de la actual (FR-004). Son enlaces de verdad:
 * funciona sin JavaScript. En una dirección que no es una página del sitio
 * lleva a la home de cada idioma.
 */
export function LanguageSwitcher({
  zone = "dark",
  isCompact = false,
  label,
}: LanguageSwitcherProps): ReactElement {
  const translate = useTranslate();
  const currentLanguage = useLanguage();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { page, params } = useCurrentPage() ?? FALLBACK_PAGE;

  // Con JavaScript el clic guarda la elección antes de cambiar de página; sin
  // él sigue siendo un enlace y la elección no se guarda.
  function handleClick(
    event: MouseEvent<HTMLAnchorElement>,
    language: Language,
    href: string,
  ): void {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    void saveLanguageChoice(language, `${pathname}${search}`).then(() =>
      navigate(href),
    );
  }

  function renderLanguage(language: Language): ReactElement {
    const isCurrent = language === currentLanguage;
    const stateStyles = isCurrent ? CURRENT_STYLES[zone] : OTHER_STYLES[zone];
    const href = `${getPagePath(page, language, params)}${search}`;
    return (
      <li key={language} className="flex">
        <Link
          to={href}
          onClick={(event) => handleClick(event, language, href)}
          lang={language}
          hrefLang={language}
          aria-current={isCurrent ? "true" : undefined}
          className={`${LINK_STYLES} ${isCompact ? COMPACT_PADDING : FULL_PADDING} ${TRANSITION_STYLES} ${stateStyles}`}
        >
          {isCompact ? (
            <>
              <span aria-hidden="true">{language.toUpperCase()}</span>
              <span className="sr-only">{LANGUAGE_NAMES[language]}</span>
            </>
          ) : (
            LANGUAGE_NAMES[language]
          )}
        </Link>
      </li>
    );
  }

  return (
    <nav aria-label={label ?? translate("languageSwitcher.label")}>
      <ul className={`${LIST_STYLES} ${LIST_ZONE_STYLES[zone]}`}>
        {SUPPORTED_LANGUAGES.map(({ code }) => renderLanguage(code))}
      </ul>
    </nav>
  );
}
