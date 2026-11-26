import type { ReactElement } from "react";

import { InboxScreen } from "~/components/panel/messages/inbox-screen";
import { parseInboxQuery, type InboxView } from "~/lib/admin/messages";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { readInbox } from "~/lib/panel/messages-inbox.server";
import { buildInboxView } from "~/lib/panel/messages-view.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/messages";

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<InboxView> {
  const query = parseInboxQuery(new URL(request.url).searchParams);
  const page = await readInbox(context.get(panelSessionContext).client, query);
  return buildInboxView(page, query, getRequestLanguage(request));
}

export default function PanelMessages({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <InboxScreen {...loaderData} />;
}
