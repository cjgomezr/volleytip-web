import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { changeMessageStatus } from "~/lib/panel/message-status.server";
import {
  sendPanelForm,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/message-answer";

export { MessageActionPage as default } from "~/components/panel/messages/message-action-page";
export { redirectToMessage as loader } from "~/lib/panel/redirect-to-message.server";

export const action = defineAdminAction({
  name: "message.answer",
  auditedFields: ["status"],
  run: (args: Route.ActionArgs) => changeMessageStatus(args, "answer"),
});

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}
