import { data, type RouterContextProvider } from "react-router";

import { getDocumentPath } from "./i18n/document-path";
import {
  buildMaintenanceNotice,
  isExemptFromMaintenance,
} from "./maintenance-mode.server";
import { MAINTENANCE_STATUS } from "./maintenance-notice";
import {
  loadSiteSettings,
  siteSettingsContext,
  type SiteSettings,
} from "./site-settings.server";

// Las direcciones exentas ni consultan la base: `/healthz` no puede depender
// de ella.
const SETTINGS_FOR_EXEMPT_PATHS: SiteSettings = {
  maintenance: { enabled: false },
  announcements: [],
};

/**
 * Middleware de la raíz: lee los ajustes del sitio una vez por petición, los
 * deja en el contexto para las páginas y, con el modo encendido, corta la
 * petición con un 503 antes de que corra ningún loader ni action.
 */
export async function enforceMaintenanceMode({
  request,
  context,
}: {
  readonly request: Request;
  readonly context: Readonly<RouterContextProvider>;
}): Promise<void> {
  const isExempt = isExemptFromMaintenance(
    getDocumentPath(new URL(request.url)),
  );
  const settings = isExempt
    ? SETTINGS_FOR_EXEMPT_PATHS
    : await loadSiteSettings();
  context.set(siteSettingsContext, settings);
  if (settings.maintenance.enabled) {
    throw data(buildMaintenanceNotice(settings.maintenance, new Date()), {
      status: MAINTENANCE_STATUS,
    });
  }
}
