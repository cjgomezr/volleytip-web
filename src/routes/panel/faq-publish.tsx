import type { ReactElement } from "react";

import { FaqListScreen } from "~/components/panel/faqs/faq-list-screen";
import type { FaqListView } from "~/lib/admin/faqs";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { changeFaqStatus } from "~/lib/panel/faq-list-actions.server";
import { loadFaqList } from "~/lib/panel/load-faq-list.server";
import {
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/faq-publish";

export function loader(args: Route.LoaderArgs): Promise<FaqListView> {
  return loadFaqList(args);
}

export const action = defineAdminAction({
  name: "faq.publish",
  auditedFields: ["status"],
  run: (args: Route.ActionArgs) => changeFaqStatus(args, "published"),
});

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

// Solo se pinta sin JavaScript: con él, el botón envía sin salir de la lista.
export default function FaqPublish({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <FaqListScreen {...loaderData} initialOutcome={withoutUnsent(actionData)} />
  );
}
