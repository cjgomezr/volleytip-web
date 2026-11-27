import type { ReactElement } from "react";
import { data } from "react-router";

import { MessageScreen } from "~/components/panel/messages/message-screen";
import { NOTICE_PARAM, type MessageView } from "~/lib/admin/messages";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { readMessage } from "~/lib/panel/messages-inbox.server";
import { buildMessageView } from "~/lib/panel/messages-view.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/message";

const NOT_FOUND_STATUS = 404;

export async function loader({
  request,
  context,
  params,
}: Route.LoaderArgs): Promise<MessageView> {
  const message = await readMessage(
    context.get(panelSessionContext).client,
    params.messageId ?? "",
  );
  if (message === null) throw data(null, { status: NOT_FOUND_STATUS });
  return buildMessageView(message, {
    language: getRequestLanguage(request),
    notice: new URL(request.url).searchParams.get(NOTICE_PARAM),
  });
}

export default function PanelMessage({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <MessageScreen {...loaderData} />;
}
