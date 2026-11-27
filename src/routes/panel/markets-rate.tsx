import type { ReactElement } from "react";

import { MarketsScreen } from "~/components/panel/markets/markets-screen";
import type { MarketsView } from "~/lib/admin/markets";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { saveUsdRate } from "~/lib/panel/usd-rate-editor.server";
import { readMarketsView } from "~/lib/panel/markets-view.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/markets-rate";

export function loader({ context }: Route.LoaderArgs): Promise<MarketsView> {
  return readMarketsView(context.get(panelSessionContext).client);
}

export const action = defineAdminAction({
  name: "settings.set_usd_rate",
  auditedFields: ["value"],
  run: async ({ request, context }: Route.ActionArgs) =>
    saveUsdRate(
      context.get(panelSessionContext).client,
      await request.formData(),
    ),
});

// Solo se pinta sin JavaScript: con él, el formulario envía sin salir de
// "Idiomas y mercados".
export default function PanelMarketsRate({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <MarketsScreen {...loaderData} rateOutcome={actionData} />;
}
