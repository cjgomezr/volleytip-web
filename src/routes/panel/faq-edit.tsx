import type { ReactElement } from "react";
import { data } from "react-router";

import { FaqEditorScreen } from "~/components/panel/faqs/faq-editor-screen";
import type { FaqEditorView } from "~/lib/admin/faqs";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { updateFaq } from "~/lib/panel/faq-editor.server";
import {
  buildFaqEditorView,
  readStoredFaq,
} from "~/lib/panel/faqs-reader.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/faq-edit";

const NOT_FOUND_STATUS = 404;

export { FaqErrorBoundary as ErrorBoundary } from "~/components/panel/faqs/faq-error";

export async function loader({
  context,
  params,
}: Route.LoaderArgs): Promise<FaqEditorView> {
  const { client } = context.get(panelSessionContext);
  const faq = await readStoredFaq(client, params.faqId ?? "");
  if (faq === null) throw data(null, { status: NOT_FOUND_STATUS });
  return buildFaqEditorView(client, faq);
}

export const action = defineAdminAction({
  name: "faq.update",
  auditedFields: ["translations"],
  run: (args: Route.ActionArgs) => updateFaq(args),
});

export default function FaqEdit({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  // Cambiar de pregunta vuelve a montar el formulario con sus textos.
  return (
    <FaqEditorScreen
      key={loaderData.faqId}
      {...loaderData}
      initialOutcome={actionData}
    />
  );
}
