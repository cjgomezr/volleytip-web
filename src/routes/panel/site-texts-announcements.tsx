import type { ReactElement } from "react";

import { SiteTextsScreen } from "~/components/panel/site-texts-screen";
import type { SiteTextsView } from "~/lib/admin/site-texts";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { saveAnnouncementBar } from "~/lib/panel/announcement-bar-editor.server";
import { readSiteTextsEditor } from "~/lib/panel/site-texts-editor.server";
import {
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/site-texts-announcements";

export function loader({ context }: Route.LoaderArgs): Promise<SiteTextsView> {
  return readSiteTextsEditor(context.get(panelSessionContext).client);
}

export const action = defineAdminAction({
  name: "settings.set_announcement_bar",
  auditedFields: ["value"],
  run: async ({ request, context }: Route.ActionArgs) =>
    saveAnnouncementBar(
      context.get(panelSessionContext).client,
      await request.formData(),
    ),
});

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

// Solo se pinta sin JavaScript: con él, el formulario envía sin salir de
// "Textos del sitio".
export default function SiteTextsAnnouncements({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <SiteTextsScreen {...loaderData} barOutcome={withoutUnsent(actionData)} />
  );
}
