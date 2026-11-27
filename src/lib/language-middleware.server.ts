import type { RouterContextProvider } from "react-router";

import {
  activeLanguagesContext,
  loadActiveLanguages,
} from "./active-languages.server";
import { isInactiveLanguagePath } from "./i18n/active-languages";
import { getDocumentPath } from "./i18n/document-path";
import { buildInactiveLanguageNotFound } from "./inactive-language-response.server";
import { isExemptFromMaintenance } from "./maintenance-mode.server";
import { enforceMaintenanceMode } from "./maintenance-middleware.server";
import { siteSettingsContext } from "./site-settings.server";

interface MiddlewareRequest {
  readonly request: Request;
  readonly context: Readonly<RouterContextProvider>;
}

/**
 * Middleware de la raíz: corta con 503 en mantenimiento y responde 404 a las
 * páginas de un idioma desactivado, antes de que corra ningún loader ni
 * action. Los ajustes y los idiomas se leen a la vez: una base lenta se espera
 * una sola vez.
 */
export async function enforceSiteAvailability({
  request,
  context,
}: MiddlewareRequest): Promise<void> {
  const pathname = getDocumentPath(new URL(request.url));
  // Las mismas direcciones que no consultan la base en mantenimiento: el
  // panel, `/healthz` y los archivos de `.well-known`.
  if (isExemptFromMaintenance(pathname)) {
    return enforceMaintenanceMode({ request, context });
  }
  // Nunca rechaza: si el mantenimiento corta la petición, no queda colgando.
  const pendingLanguages = loadActiveLanguages();
  await enforceMaintenanceMode({ request, context });
  const activeLanguages = await pendingLanguages;
  context.set(activeLanguagesContext, activeLanguages);
  if (isInactiveLanguagePath(pathname, activeLanguages)) {
    const { announcements } = context.get(siteSettingsContext);
    throw buildInactiveLanguageNotFound(activeLanguages, announcements);
  }
}
