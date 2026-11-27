import type { ReactElement } from "react";

import { FaqListScreen } from "~/components/panel/faqs/faq-list-screen";
import type { FaqListView } from "~/lib/admin/faqs";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { changeFaqStatus } from "~/lib/panel/faq-list-actions.server";
import { loadFaqList } from "~/lib/panel/load-faq-list.server";

import type { Route } from "./+types/faq-publish";

export { FaqErrorBoundary as ErrorBoundary } from "~/components/panel/faqs/faq-error";

export function loader(args: Route.LoaderArgs): Promise<FaqListView> {
  return loadFaqList(args);
}

export const action = defineAdminAction({
  name: "faq.publish",
  auditedFields: ["status"],
  run: (args: Route.ActionArgs) => changeFaqStatus(args, "published"),
});

// Solo se pinta sin JavaScript: con él, el botón envía sin salir de la lista.
export default function FaqPublish({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <FaqListScreen {...loaderData} initialOutcome={actionData} />;
}
