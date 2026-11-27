import { useEffect } from "react";

import type { PanelPageId } from "../i18n/panel-pages";
import { buildRouteId } from "../i18n/page-path";
import { useLanguage } from "../i18n/use-language";
import { loadRouteCode } from "./load-route-code";

/**
 * Trae por adelantado el código de la ruta a la que envía un formulario. React
 * Router lo necesita para enviar y, si al enviar no hay red y no lo tiene,
 * recarga la página: se pierde lo escrito. Lo llama cada formulario que envía
 * a una dirección distinta de la de su pantalla. Solo trae código: no pide
 * ningún dato.
 */
export function usePreloadSubmission(page: PanelPageId): void {
  const routeId = buildRouteId(page, useLanguage());
  useEffect(() => loadRouteCode(routeId), [routeId]);
}
