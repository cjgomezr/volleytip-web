import type { ReactElement } from "react";
import { redirect } from "react-router";

import { PanelScreen } from "~/components/panel-screen";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { RETURN_PARAM, resolveReturnPath } from "~/lib/panel/return-path";
import { identifyVisitor } from "~/lib/panel/visitor.server";

import type { Route } from "./+types/sign-in";

// Quien ya está adentro no vuelve a entrar: va a donde iba.
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<null> {
  const visitor = await identifyVisitor(
    context.get(panelSessionContext).client,
  );
  if (visitor.kind !== "member") return null;
  const requested = new URL(request.url).searchParams.get(RETURN_PARAM);
  throw redirect(resolveReturnPath(requested, getRequestLanguage(request)));
}

/** La pantalla de entrada. Su formulario lo construye el ticket del enlace. */
export function SignInScreen(): ReactElement {
  const translate = useTranslate();
  return (
    <PanelScreen title={translate("panel.signIn.title")}>
      <p className="mt-6 text-[16px] leading-[1.5]">
        {translate("panel.signIn.details")}
      </p>
    </PanelScreen>
  );
}

export default function SignIn(): ReactElement {
  return <SignInScreen />;
}
