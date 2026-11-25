import type { ReactElement } from "react";
import { Outlet } from "react-router";

import { requireAdmin } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/admin-layout";

// Las secciones del panel van aquí: el staff no llega a ninguna.
export const middleware: Route.MiddlewareFunction[] = [requireAdmin];

export default function PanelAdminLayout(): ReactElement {
  return <Outlet />;
}
