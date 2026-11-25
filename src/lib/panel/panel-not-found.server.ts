import { data } from "react-router";

import { pickAnnouncementMessages } from "../announcement-bar.server";
import { getSiteYear } from "../i18n/format";
import { getRequestLanguage } from "../i18n/languages";
import { getMessages } from "../i18n/messages.server";
import { loadSiteSettings } from "../site-settings.server";
import { buildPanelNotFoundData, type PanelNotFound } from "./panel-not-found";

const NOT_FOUND_STATUS = 404;

/** El 404 que se lanza en el panel: igual al de una página que no existe,
 * con su barra de anuncios (AC-033). */
export async function buildPanelNotFound(
  request: Request,
): Promise<ReturnType<typeof data<PanelNotFound>>> {
  const language = getRequestLanguage(request);
  // Las direcciones del panel están exentas de mantenimiento y el middleware
  // de la raíz no lee los ajustes para ellas.
  const { announcements } = await loadSiteSettings();
  return data(
    buildPanelNotFoundData({
      messages: getMessages(language),
      year: getSiteYear(new Date()),
      announcements: pickAnnouncementMessages(announcements, language),
    }),
    { status: NOT_FOUND_STATUS },
  );
}
