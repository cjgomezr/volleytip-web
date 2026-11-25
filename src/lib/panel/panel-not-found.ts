import { isRouteErrorResponse } from "react-router";

import type { Messages } from "../i18n/translate";

const PANEL_NOT_FOUND = "panel-not-found";

/** Lo que lleva el 404 del panel para pintarse como cualquier otro. La
 * guardia corre antes que los loaders, así que la raíz no tiene sus datos y
 * la respuesta tiene que traerlos. */
export interface PanelNotFound {
  readonly kind: typeof PANEL_NOT_FOUND;
  readonly messages: Messages;
  readonly year: number;
  readonly announcements: readonly string[];
}

export function buildPanelNotFoundData(
  content: Omit<PanelNotFound, "kind">,
): PanelNotFound {
  return { kind: PANEL_NOT_FOUND, ...content };
}

function isPanelNotFound(value: unknown): value is PanelNotFound {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === PANEL_NOT_FOUND
  );
}

/** Los datos del 404 del panel, si ese es el error que se está pintando. */
export function findPanelNotFound(error: unknown): PanelNotFound | undefined {
  return isRouteErrorResponse(error) && isPanelNotFound(error.data)
    ? error.data
    : undefined;
}
