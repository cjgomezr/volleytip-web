import type { ReactElement } from "react";
import { Outlet } from "react-router";

import type { PendingCounts } from "~/lib/admin/navigation";
import {
  panelMemberContext,
  panelSessionContext,
  requirePanelMember,
} from "~/lib/panel/panel-middleware.server";
import { countNewMessages } from "~/lib/panel/messages-inbox.server";
import { loadSiteSettings } from "~/lib/site-settings.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";

import type { Route } from "./+types/member-layout";

// Todo lo que cuelga de aquí pide un perfil del equipo activo. El middleware
// solo corre en una navegación sin recargar si la ruta pide datos: cada
// página del panel tiene su loader.
export const middleware: Route.MiddlewareFunction[] = [requirePanelMember];

export type PanelLayout =
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

// Cada módulo con contador agrega aquí cómo se cuenta, con su ticket. Un
// conteo que falla no puede dejar el panel sin abrir: queda en el registro y
// la entrada sale sin número.
async function countPending(
  client: TypedSupabaseClient,
): Promise<PendingCounts> {
  try {
    return { messages: await countNewMessages(client) };
  } catch (error) {
    console.error("El panel no pudo contar los mensajes nuevos", error);
    return {};
  }
}

export async function loader({
  context,
}: Route.LoaderArgs): Promise<PanelLayout> {
  const member = context.get(panelMemberContext);
  if (member.role === "staff") return { view: "staff" };
  // El panel está exento del mantenimiento y el middleware de la raíz no lee
  // los ajustes para él.
  const { client } = context.get(panelSessionContext);
  const [{ maintenance }, pendingCounts] = await Promise.all([
    loadSiteSettings(client),
    countPending(client),
  ]);
  return {
    view: "admin",
    member: {
      displayName: member.fullName ?? member.email,
      role: member.role,
    },
    pendingCounts,
    isMaintenanceOn: maintenance.enabled,
  };
}

// La cáscara la pinta `shell-layout.tsx` con estos datos: así también está
// cuando una pantalla falla.
export default function PanelMemberLayout(): ReactElement {
  return <Outlet />;
}
