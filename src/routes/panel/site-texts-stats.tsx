import type { ReactElement } from "react";

import { SiteTextsScreen } from "~/components/panel/site-texts-screen";
import type { SiteTextsView } from "~/lib/admin/site-texts";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import {
  saveSiteStats,
  STAT_AUDITED_FIELDS,
} from "~/lib/panel/site-stats-editor.server";
import { readSiteTextsEditor } from "~/lib/panel/site-texts-editor.server";

import type { Route } from "./+types/site-texts-stats";

export function loader({ context }: Route.LoaderArgs): Promise<SiteTextsView> {
  return readSiteTextsEditor(context.get(panelSessionContext).client);
}

export const action = defineAdminAction({
  name: "site_text.update",
  auditedFields: STAT_AUDITED_FIELDS,
  run: async ({ request, context }: Route.ActionArgs) =>
    saveSiteStats(
      context.get(panelSessionContext).client,
      await request.formData(),
    ),
});

// Solo se pinta sin JavaScript: con él, el formulario envía sin salir de
// "Textos del sitio".
export default function SiteTextsStats({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <SiteTextsScreen {...loaderData} statsOutcome={actionData} />;
}
