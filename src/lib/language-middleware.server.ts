import { data, type RouterContextProvider } from "react-router";

import {
  activeLanguagesContext,
  loadActiveLanguages,
} from "./active-languages.server";
import { pickAnnouncementMessages } from "./announcement-bar.server";
import { isInactiveLanguagePath } from "./i18n/active-languages";
import { getDocumentPath } from "./i18n/document-path";
import { getSiteYear } from "./i18n/format";
import { buildInactiveLanguageData } from "./i18n/inactive-language-not-found";
import { DEFAULT_LANGUAGE } from "./i18n/languages";
import { getMessages } from "./i18n/messages.server";
import { isExemptFromMaintenance } from "./maintenance-mode.server";
import { siteSettingsContext } from "./site-settings.server";

const NOT_FOUND_STATUS = 404;

/**
 * Middleware de la raíz, después del de mantenimiento: lee qué idiomas están
 * activos y responde 404 a las páginas de uno desactivado antes de que corra
 * ningún loader ni action.
 */
export async function enforceActiveLanguages({
  request,
  context,
}: {
  readonly request: Request;
  readonly context: Readonly<RouterContextProvider>;
}): Promise<void> {
  const pathname = getDocumentPath(new URL(request.url));
  // Las mismas direcciones que no consultan la base en mantenimiento: el
  // panel, `/healthz` y los archivos de `.well-known`.
  if (isExemptFromMaintenance(pathname)) return;
  const activeLanguages = await loadActiveLanguages();
  context.set(activeLanguagesContext, activeLanguages);
  if (!isInactiveLanguagePath(pathname, activeLanguages)) return;
  const { announcements } = context.get(siteSettingsContext);
  throw data(
    buildInactiveLanguageData({
      activeLanguages,
      messages: getMessages(DEFAULT_LANGUAGE),
      year: getSiteYear(new Date()),
      announcements: pickAnnouncementMessages(announcements, DEFAULT_LANGUAGE),
    }),
    { status: NOT_FOUND_STATUS },
  );
}
