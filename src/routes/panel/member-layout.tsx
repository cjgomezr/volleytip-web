import type { ReactElement } from "react";
import { Outlet } from "react-router";

import { PanelShell } from "~/components/panel/panel-shell";
import { ADMIN_MODULES } from "~/lib/admin/modules";
import type { PendingCounts } from "~/lib/admin/navigation";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";
import {
  panelMemberContext,
  requirePanelMember,
} from "~/lib/panel/panel-middleware.server";
import { loadSiteSettings } from "~/lib/site-settings.server";

import type { Route } from "./+types/member-layout";

// Todo lo que cuelga de aquí pide un perfil del equipo activo. El middleware
// solo corre en una navegación sin recargar si la ruta pide datos: cada
// página del panel tiene su loader.
export const middleware: Route.MiddlewareFunction[] = [requirePanelMember];

type PanelLayout =
  | { readonly view: "staff" }
  | {
      readonly view: "admin";
      readonly member: {
        readonly displayName: string;
        readonly role: "admin";
      };
      readonly pendingCounts: PendingCounts;
      readonly isMaintenanceOn: boolean;
    };

export async function loader({
  context,
}: Route.LoaderArgs): Promise<PanelLayout> {
  const member = context.get(panelMemberContext);
  if (member.role === "staff") return { view: "staff" };
  // El panel está exento del mantenimiento y el middleware de la raíz no lee
  // los ajustes para él.
  const { maintenance } = await loadSiteSettings();
  return {
    view: "admin",
    member: {
      displayName: member.fullName ?? member.email,
      role: member.role,
    },
    // Cada módulo con contador agrega aquí cómo se cuenta, con su ticket.
    pendingCounts: {},
    isMaintenanceOn: maintenance.enabled,
  };
}

export default function PanelMemberLayout({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const language = useLanguage();
  if (loaderData.view === "staff") return <Outlet />;
  return (
    <PanelShell
      modules={ADMIN_MODULES}
      member={loaderData.member}
      pendingCounts={loaderData.pendingCounts}
      isMaintenanceOn={loaderData.isMaintenanceOn}
      morePath={getPanelPath("adminMore", language)}
      languageAction={getPanelPath("adminLanguage", language)}
    >
      <Outlet />
    </PanelShell>
  );
}
