import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { changeMessageStatus } from "~/lib/panel/message-status.server";

import type { Route } from "./+types/message-answer";

export { MessageActionPage as default } from "~/components/panel/messages/message-action-page";
export { MessageErrorBoundary as ErrorBoundary } from "~/components/panel/messages/message-error";
export { redirectToMessage as loader } from "~/lib/panel/redirect-to-message.server";

export const action = defineAdminAction({
  name: "message.answer",
  auditedFields: ["status"],
  run: (args: Route.ActionArgs) => changeMessageStatus(args, "answer"),
});
