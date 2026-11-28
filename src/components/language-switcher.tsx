import { useState, type MouseEvent, type ReactElement } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useActiveLanguages } from "~/lib/i18n/active-languages-context";
import { LANGUAGE_NAMES, type Language } from "~/lib/i18n/languages";
import { translatePageSearch } from "~/lib/i18n/page-search";
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

/** El idioma recién elegido y la entrada del historial donde se eligió. */
interface PendingChoice {
  readonly language: Language;
  readonly locationKey: string;
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
 * Un enlace por idioma activo hacia la misma página en ese idioma, con los
 * parámetros de búsqueda de la actual, escritos en ese idioma (FR-004). Son enlaces de verdad:
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
  const activeLanguages = useActiveLanguages();
  const { pathname, search, key: locationKey } = useLocation();
  const navigate = useNavigate();
  const { page, params } = useCurrentPage() ?? FALLBACK_PAGE;
  // Guardar la elección ocurre antes de la navegación, así que
  // `useNavigation` todavía no la ve: por eso el idioma recién elegido se
  // recuerda aquí. Vale solo en la entrada del historial donde se hizo el
  // clic y se descarta en el mismo pintado en que llega otra dirección, sea la
  // página nueva o cualquier otra. Así el selector nunca vuelve un instante al
  // idioma viejo, ni queda marcado al regresar con el botón atrás.
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(
    null,
  );
  if (pendingChoice !== null && pendingChoice.locationKey !== locationKey) {
    setPendingChoice(null);
  }
  const selectedLanguage = pendingChoice?.language ?? currentLanguage;

  // Con JavaScript el clic guarda la elección antes de cambiar de página; sin
  // él sigue siendo un enlace y la elección no se guarda. El selector marca el
  // idioma elegido de inmediato: sin eso el clic parece no haber hecho nada
  // mientras responden el guardado y la página nueva.
  function handleClick(
    event: MouseEvent<HTMLAnchorElement>,
    language: Language,
    href: string,
  ): void {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    // Un segundo clic mientras el primero viaja pondría a competir dos
    // guardados y dos navegaciones.
    if (pendingChoice !== null) return;
    setPendingChoice({ language, locationKey });
    // `saveLanguageChoice` nunca rechaza: si falla, igual se navega.
    void saveLanguageChoice(language, `${pathname}${search}`).then(() =>
      navigate(href),
    );
  }

  function renderLanguage(language: Language): ReactElement {
    const isCurrent = language === selectedLanguage;
    const stateStyles = isCurrent ? CURRENT_STYLES[zone] : OTHER_STYLES[zone];
    const translatedSearch = translatePageSearch({
      page,
      search,
      from: currentLanguage,
      to: language,
    });
    const href = `${getPagePath(page, language, params)}${translatedSearch}`;
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
        {activeLanguages.map(renderLanguage)}
      </ul>
    </nav>
  );
}
