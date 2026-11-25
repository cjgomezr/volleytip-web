import { redirect } from "react-router";

import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { closeSession } from "~/lib/panel/close-session.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/sign-out";

// Abrir la dirección no cierra nada: cerrar sesión es un envío.
export function loader({ request }: Route.LoaderArgs): Response {
  return redirect(getPanelPath("adminHome", getRequestLanguage(request)));
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<Response> {
  await closeSession(context.get(panelSessionContext).client);
  return redirect(getPanelPath("adminSignIn", getRequestLanguage(request)));
}

// Nunca se pinta: el loader y el action siempre redirigen. Hace falta para
// que la ruta sea una página y un 404 de la guardia salga con el documento.
export default function SignOut(): null {
  return null;
}
