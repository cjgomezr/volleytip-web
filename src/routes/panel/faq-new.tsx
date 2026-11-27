import type { ReactElement } from "react";

import { FaqEditorScreen } from "~/components/panel/faqs/faq-editor-screen";
import type { FaqEditorView } from "~/lib/admin/faqs";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { createFaq } from "~/lib/panel/faq-editor.server";
import { buildFaqEditorView } from "~/lib/panel/faqs-reader.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import {
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/faq-new";

export { FaqErrorBoundary as ErrorBoundary } from "~/components/panel/faqs/faq-error";

export function loader({ context }: Route.LoaderArgs): Promise<FaqEditorView> {
  return buildFaqEditorView(context.get(panelSessionContext).client, null);
}

export const action = defineAdminAction({
  name: "faq.create",
  auditedFields: ["status", "sort_order", "translations"],
  run: (args: Route.ActionArgs) => createFaq(args),
});

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

export default function FaqNew({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <FaqEditorScreen
      {...loaderData}
      initialOutcome={withoutUnsent(actionData)}
    />
  );
}
