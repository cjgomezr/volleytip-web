import { redirect } from "react-router";

import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import {
  GOOGLE_NOTICE_PARAM,
  type GoogleNotice,
} from "~/lib/panel/google-notice";
import { completeGoogleSignIn } from "~/lib/panel/google-sign-in.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import {
  buildSignInPathFor,
  findRequestedPage,
  resolveSignedInPath,
  RETURN_PARAM,
} from "~/lib/panel/return-path";

import type { Route } from "./+types/sign-in-google-return";

// La entrada con el aviso, conservando la página a la que se iba.
function buildRefusalPath(
  notice: GoogleNotice,
  returnPath: string | null,
  language: Language,
): string {
  const signIn = buildSignInPathFor(returnPath, language);
  const separator = signIn.includes("?") ? "&" : "?";
  return `${signIn}${separator}${GOOGLE_NOTICE_PARAM}=${notice}`;
}

// La ruta a la que se vuelve desde Google. No pinta nada: canjea el código y
// siempre lleva a otra parte.
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const returnPath = findRequestedPage(params.get(RETURN_PARAM));
  const { client } = context.get(panelSessionContext);
  const result = await completeGoogleSignIn(client, params);
  if (result.status === "signed_in") {
    return redirect(resolveSignedInPath(returnPath, result.language));
  }
  return redirect(
    buildRefusalPath(result.status, returnPath, getRequestLanguage(request)),
  );
}
