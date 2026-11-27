import type { ReactElement } from "react";
import { useLocation } from "react-router";

import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type Language,
} from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { TRANSITION_STYLES } from "../pressable-styles";
import { UnsentNotice } from "./unsent-notice";

// 44 px de alto y de ancho: la zona de toque mínima en celular.
const BUTTON_STYLES = `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-pill px-3 text-[14px] font-bold ${TRANSITION_STYLES}`;
const CURRENT_STYLES =
  "bg-brand-mist text-brand-night hovered:bg-brand-lime pressed:bg-brand-lime";
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
  // Mientras viaja un cambio, un segundo clic no envía otro.
  const fetcher = usePanelFetcher();
  const isSaving = fetcher.isSending;

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
        aria-disabled={isSaving || undefined}
        onClick={isSaving ? (event) => event.preventDefault() : undefined}
        className={`${BUTTON_STYLES} aria-disabled:cursor-progress ${isCurrent ? CURRENT_STYLES : OTHER_STYLES}`}
      >
        <span aria-hidden="true">{language.toUpperCase()}</span>
        <span className="sr-only">{LANGUAGE_NAMES[language]}</span>
      </button>
    );
  }

  return (
    <fetcher.Form
      method="post"
      action={action}
      className="flex shrink-0 flex-col items-end gap-2 md:items-start"
    >
      <input type="hidden" name="from" value={`${pathname}${search}`} />
      <div
        role="group"
        aria-label={translate("panel.language.label")}
        className="inline-flex rounded-pill border-2 border-brand-mist"
      >
        {SUPPORTED_LANGUAGES.map(({ code }) => renderLanguage(code))}
      </div>
      {fetcher.isUnsent ? (
        <div className="max-w-[200px]">
          <UnsentNotice zone="dark" />
        </div>
      ) : null}
    </fetcher.Form>
  );
}
