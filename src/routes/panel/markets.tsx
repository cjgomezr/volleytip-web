import type { ReactElement } from "react";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { MarketsScreen } from "~/components/panel/markets/markets-screen";
import type { MarketsView } from "~/lib/admin/markets";
import { readMarketsView } from "~/lib/panel/markets-view.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/markets";

export function loader({ context }: Route.LoaderArgs): Promise<MarketsView> {
  return readMarketsView(context.get(panelSessionContext).client);
}

// React Router no vuelve a cargar tras un 400. Aquí un rechazo puede venir de
// algo que cambió en otra parte, como un idioma que se acaba de desactivar: se
// vuelve a leer para no ofrecerlo otra vez.
export function shouldRevalidate({
  actionStatus,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  return actionStatus === 400 || defaultShouldRevalidate;
}

export default function PanelMarkets({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <MarketsScreen {...loaderData} />;
}
