import type { ReactElement } from "react";

import { MarketsScreen } from "~/components/panel/markets/markets-screen";
import type { MarketsView } from "~/lib/admin/markets";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { saveLanguageState } from "~/lib/panel/language-editor.server";
import { readMarketsView } from "~/lib/panel/markets-view.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import {
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/markets-language";

export function loader({ context }: Route.LoaderArgs): Promise<MarketsView> {
  return readMarketsView(context.get(panelSessionContext).client);
}

export const action = defineAdminAction({
  name: "language.set_active",
  auditedFields: ["is_active"],
  run: async ({ request, context }: Route.ActionArgs) =>
    saveLanguageState(
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
// "Idiomas y mercados".
export default function PanelMarketsLanguage({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <MarketsScreen
      {...loaderData}
      languageOutcome={withoutUnsent(actionData)}
    />
  );
}
