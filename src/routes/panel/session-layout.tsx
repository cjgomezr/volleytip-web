import type { ReactElement } from "react";
import { Outlet } from "react-router";

import {
  attachPanelSession,
  rejectForeignOrigin,
} from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/session-layout";

// El orden importa: la sesión envuelve también al 403 del origen.
export const middleware: Route.MiddlewareFunction[] = [
  attachPanelSession,
  rejectForeignOrigin,
];

// Ruta de layout de todo el panel y de su entrada, fuera de la cáscara del
// sitio.
export default function PanelSessionLayout(): ReactElement {
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <Outlet />
    </>
  );
}
