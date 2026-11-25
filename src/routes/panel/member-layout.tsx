import type { ReactElement } from "react";
import { Outlet } from "react-router";

import { requirePanelMember } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/member-layout";

// Todo lo que cuelga de aquí pide un perfil del equipo activo. El middleware
// solo corre en una navegación sin recargar si la ruta pide datos: cada
// página del panel tiene su loader.
export const middleware: Route.MiddlewareFunction[] = [requirePanelMember];

export default function PanelMemberLayout(): ReactElement {
  return <Outlet />;
}
