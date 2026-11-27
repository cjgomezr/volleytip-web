import { data } from "react-router";

import { loadActiveLanguages } from "../active-languages.server";
import { pickAnnouncementMessages } from "../announcement-bar.server";
import { getSiteYear } from "../i18n/format";
import { loadLanguageSuggestion } from "../i18n/language-suggestion.server";
import { getRequestLanguage } from "../i18n/languages";
import { getMessages } from "../i18n/messages.server";
import { buildInactiveLanguageNotFound } from "../inactive-language-response.server";
import { loadSiteSettings } from "../site-settings.server";
import type { InactiveLanguageNotFound } from "../i18n/inactive-language-not-found";
import { buildPanelNotFoundData, type PanelNotFound } from "./panel-not-found";

const NOT_FOUND_STATUS = 404;

/** El 404 que se lanza en el panel: igual al de una página que no existe,
 * con su barra de anuncios y su aviso de idioma (AC-033). En la dirección de
 * un idioma desactivado es el 404 que dan sus demás páginas. */
export async function buildPanelNotFound(
  request: Request,
): Promise<ReturnType<typeof data<PanelNotFound | InactiveLanguageNotFound>>> {
  const language = getRequestLanguage(request);
  // Las direcciones del panel están exentas de mantenimiento y los
  // middleware de la raíz no leen los ajustes ni los idiomas para ellas.
  const [{ announcements }, activeLanguages] = await Promise.all([
    loadSiteSettings(),
    loadActiveLanguages(),
  ]);
  if (!activeLanguages.includes(language)) {
    return buildInactiveLanguageNotFound(activeLanguages, announcements);
  }
  return data(
    buildPanelNotFoundData({
      activeLanguages,
      messages: getMessages(language),
      year: getSiteYear(new Date()),
      announcements: pickAnnouncementMessages(announcements, language),
      languageSuggestion: await loadLanguageSuggestion(
        request,
        activeLanguages,
      ),
    }),
    { status: NOT_FOUND_STATUS },
  );
}
