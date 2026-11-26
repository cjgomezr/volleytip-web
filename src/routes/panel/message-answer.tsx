import { redirect } from "react-router";

import { getRequestLanguage } from "~/lib/i18n/languages";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { changeMessageStatus } from "~/lib/panel/message-status.server";
import { buildMessagePath } from "~/lib/panel/messages-view.server";

import type { Route } from "./+types/message-answer";

export { MessageErrorBoundary as ErrorBoundary } from "~/components/panel/messages/message-error";

// Abrir la dirección no cambia nada: el cambio es un envío.
export function loader({ request, params }: Route.LoaderArgs): Response {
  const language = getRequestLanguage(request);
  return redirect(buildMessagePath(params.messageId ?? "", language));
}

export const action = defineAdminAction({
  name: "message.answer",
  auditedFields: ["status"],
  run: (args: Route.ActionArgs) => changeMessageStatus(args, "answer"),
});

// Nunca se pinta: el loader y el action responden antes. Hace falta para que
// la ruta sea una página y un error salga con el documento.
export default function PanelMessageAnswer(): null {
  return null;
}
