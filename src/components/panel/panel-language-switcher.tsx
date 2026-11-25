import type { ReactElement } from "react";
import { Form, useLocation } from "react-router";

import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type Language,
} from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { TRANSITION_STYLES } from "../pressable-styles";

// 44 px de alto y de ancho: la zona de toque mínima en celular.
const BUTTON_STYLES = `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-pill px-3 text-[14px] font-bold ${TRANSITION_STYLES}`;
const CURRENT_STYLES = "bg-brand-mist text-brand-night";
const OTHER_STYLES =
  "bg-transparent text-brand-mist hovered:text-brand-lime pressed:text-brand-lime";

/**
 * El selector de idioma del panel. A diferencia del selector del sitio es un
 * envío: además de cambiar de pantalla, guarda el idioma en el perfil. Funciona
 * sin JavaScript.
 */
export function PanelLanguageSwitcher({
  action,
}: {
  readonly action: string;
}): ReactElement {
  const translate = useTranslate();
  const currentLanguage = useLanguage();
  const { pathname, search } = useLocation();

  function renderLanguage(language: Language): ReactElement {
    const isCurrent = language === currentLanguage;
    return (
      <button
        key={language}
        type="submit"
        name="language"
        value={language}
        lang={language}
        aria-current={isCurrent ? "true" : undefined}
        className={`${BUTTON_STYLES} ${isCurrent ? CURRENT_STYLES : OTHER_STYLES}`}
      >
        <span aria-hidden="true">{language.toUpperCase()}</span>
        <span className="sr-only">{LANGUAGE_NAMES[language]}</span>
      </button>
    );
  }

  return (
    <Form method="post" action={action} className="shrink-0">
      <input type="hidden" name="from" value={`${pathname}${search}`} />
      <div
        role="group"
        aria-label={translate("panel.language.label")}
        className="inline-flex rounded-pill border-2 border-brand-mist"
      >
        {SUPPORTED_LANGUAGES.map(({ code }) => renderLanguage(code))}
      </div>
    </Form>
  );
}
