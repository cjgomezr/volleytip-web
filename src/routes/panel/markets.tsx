import type { ReactElement } from "react";

import { MarketsScreen } from "~/components/panel/markets/markets-screen";
import type { MarketsView } from "~/lib/admin/markets";
import { readMarketsView } from "~/lib/panel/markets-view.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/markets";

export function loader({ context }: Route.LoaderArgs): Promise<MarketsView> {
  return readMarketsView(context.get(panelSessionContext).client);
}

export default function PanelMarkets({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <MarketsScreen {...loaderData} />;
}
