import type { ReactElement } from "react";
import { redirect, type ShouldRevalidateFunctionArgs } from "react-router";

import { SignInForm } from "~/components/panel/sign-in-form";
import { SignInLayout } from "~/components/panel/sign-in-layout";
import {
  ADMIN_SIGN_IN_FORM,
  handleSignInRequest,
  type SignInOutcome,
} from "~/lib/forms/admin-sign-in-form.server";
import {
  issueFormProtection,
  type FormProtectionFields,
} from "~/lib/forms/protected-form.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { RETURN_PARAM, resolveReturnPath } from "~/lib/panel/return-path";
import { identifyVisitor } from "~/lib/panel/visitor.server";
import {
  isUnsentSubmission,
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/sign-in";

// Quien ya está adentro no vuelve a entrar: va a donde iba.
export async function loader({ request, context }: Route.LoaderArgs): Promise<{
  readonly protection: FormProtectionFields;
}> {
  const visitor = await identifyVisitor(
    context.get(panelSessionContext).client,
  );
  if (visitor.kind !== "member") {
    return { protection: issueFormProtection(ADMIN_SIGN_IN_FORM) };
  }
  const requested = new URL(request.url).searchParams.get(RETURN_PARAM);
  throw redirect(resolveReturnPath(requested, getRequestLanguage(request)));
}

export function action({
  request,
}: Route.ActionArgs): ReturnType<typeof handleSignInRequest> {
  return handleSignInRequest(request);
}

// React Router no vuelve a pedir los datos tras un envío rechazado. Con la
// marca de tiempo vencida (una pestaña abierta más de un día) cada reintento
// fallaría igual: este rechazo pide un formulario fresco.
export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  const outcome = actionResult as SignInOutcome | undefined;
  const isStale =
    outcome?.status === "rejected" && outcome.reason === "too_fast";
  return isStale || defaultShouldRevalidate;
}

export function SignInScreen({
  protection,
  outcome,
  isUnsent,
}: {
  readonly protection: FormProtectionFields;
  readonly outcome: SignInOutcome | undefined;
  /** El envío no llegó al servidor. */
  readonly isUnsent?: boolean;
}): ReactElement {
  const translate = useTranslate();
  const heading =
    outcome?.status === "sent"
      ? "panel.signIn.sent.title"
      : "panel.signIn.heading";
  return (
    <SignInLayout heading={translate(heading)}>
      <SignInForm
        protection={protection}
        outcome={outcome}
        isUnsent={isUnsent}
      />
    </SignInLayout>
  );
}

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

export default function SignIn({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <SignInScreen
      {...loaderData}
      outcome={withoutUnsent(actionData)}
      isUnsent={isUnsentSubmission(actionData)}
    />
  );
}
