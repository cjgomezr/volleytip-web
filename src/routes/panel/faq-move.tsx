import type { ReactElement } from "react";

import { FaqListScreen } from "~/components/panel/faqs/faq-list-screen";
import type { FaqListView } from "~/lib/admin/faqs";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { moveFaq } from "~/lib/panel/faq-list-actions.server";
import { loadFaqList } from "~/lib/panel/load-faq-list.server";

import type { Route } from "./+types/faq-move";

export { FaqErrorBoundary as ErrorBoundary } from "~/components/panel/faqs/faq-error";

export function loader(args: Route.LoaderArgs): Promise<FaqListView> {
  return loadFaqList(args);
}

export const action = defineAdminAction({
  name: "faq.reorder",
  auditedFields: ["position"],
  run: (args: Route.ActionArgs) => moveFaq(args),
});

// Solo se pinta sin JavaScript: con él, el botón envía sin salir de la lista.
export default function FaqMove({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <FaqListScreen {...loaderData} initialOutcome={actionData} />;
}
