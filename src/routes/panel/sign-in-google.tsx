import { data, redirect } from "react-router";

import { serverEnv } from "~/lib/env.server";
import { readFormData } from "~/lib/forms/protected-form.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { startGoogleSignIn } from "~/lib/panel/google-sign-in.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { findRequestedPage, RETURN_PARAM } from "~/lib/panel/return-path";
import {
  sendPanelForm,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/sign-in-google";

const NOT_FOUND_STATUS = 404;

// Abrir la dirección no empieza nada: ir a Google es un envío.
export function loader({ request }: Route.LoaderArgs): Response {
  return redirect(getPanelPath("adminSignIn", getRequestLanguage(request)));
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<Response> {
  if (!serverEnv.googleSignInEnabled) {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const requested = (await readFormData(request)).get(RETURN_PARAM);
  const url = await startGoogleSignIn(context.get(panelSessionContext).client, {
    language: getRequestLanguage(request),
    returnPath: findRequestedPage(
      typeof requested === "string" ? requested : null,
    ),
  });
  return redirect(url);
}

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

// Nunca se pinta: el loader y el action siempre redirigen.
export default function SignInGoogle(): null {
  return null;
}
