import type { ReactElement } from "react";
import { redirect } from "react-router";

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

export function SignInScreen({
  protection,
  outcome,
}: {
  readonly protection: FormProtectionFields;
  readonly outcome: SignInOutcome | undefined;
}): ReactElement {
  const translate = useTranslate();
  return (
    <SignInLayout heading={translate("panel.signIn.heading")}>
      <SignInForm protection={protection} outcome={outcome} />
    </SignInLayout>
  );
}

export default function SignIn({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <SignInScreen {...loaderData} outcome={actionData} />;
}
