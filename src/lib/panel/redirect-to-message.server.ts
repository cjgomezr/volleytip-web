import { redirect, type LoaderFunctionArgs } from "react-router";

import { getRequestLanguage } from "../i18n/languages";
import { buildMessagePath } from "./messages-view.server";

/** El loader de las rutas que cambian un mensaje: abrir la dirección no
 * cambia nada (el cambio es un envío) y lleva a su detalle. */
export function redirectToMessage({
  request,
  params,
}: LoaderFunctionArgs): Response {
  const language = getRequestLanguage(request);
  return redirect(buildMessagePath(params.messageId ?? "", language));
}
