import {
  createContext,
  data,
  redirect,
  type MiddlewareFunction,
} from "react-router";

import { serverEnv } from "../env.server";
import { getRequestLanguage } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import { NO_INDEX_DIRECTIVES } from "../indexing.server";
import {
  createSessionSupabaseClient,
  type SessionSupabase,
} from "../supabase/session-client.server";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { closeSession } from "./close-session.server";
import { buildPanelNotFound } from "./panel-not-found.server";
import { buildSignInPath } from "./return-path";
import { isTrustedSubmission } from "./trusted-origin.server";
import { identifyVisitor, type PanelMember } from "./visitor.server";

const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;

/** El cliente de Supabase con la sesión de la petición. Lo leen los loaders
 * y actions del panel para consultar como la persona. */
export const panelSessionContext = createContext<SessionSupabase>();

/** Quién pasó la guardia. Solo existe detrás de `requirePanelMember`. */
export const panelMemberContext = createContext<PanelMember>();

/**
 * Envuelve toda ruta del panel y de la entrada: crea el cliente de la sesión
 * y, ya con la respuesta armada, le pone las cookies que cambiaron. Nada del
 * panel se indexa ni se guarda en una caché.
 */
export const attachPanelSession: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const session = createSessionSupabaseClient(request);
  context.set(panelSessionContext, session);
  const response = await next();
  session.writeCookies(response.headers);
  response.headers.set("Cache-Control", "private, no-store");
  // El 404 sale sin la cabecera, como el de cualquier página que no existe.
  if (response.status !== NOT_FOUND_STATUS) {
    response.headers.set("X-Robots-Tag", NO_INDEX_DIRECTIVES);
  }
  return response;
};

/** Un envío al panel desde otro origen se corta antes de mirar la sesión. */
export const rejectForeignOrigin: MiddlewareFunction<Response> = ({
  request,
}) => {
  if (!isTrustedSubmission(request, serverEnv)) {
    throw data(null, { status: FORBIDDEN_STATUS });
  }
};

/**
 * Devuelve quién del equipo hace la petición, o lanza la respuesta de la
 * guardia: sin sesión lleva a la entrada y a quien no es del equipo le
 * responde 404. A una cuenta desactivada además le cierra la sesión: si no,
 * "Cerrar sesión" no llegaría a su action y las cookies volverían a servir al
 * reactivarla.
 */
export async function verifyPanelMember(
  request: Request,
  client: TypedSupabaseClient,
): Promise<PanelMember> {
  const visitor = await identifyVisitor(client);
  if (visitor.kind === "outsider") {
    throw await buildPanelNotFound(request);
  }
  if (visitor.kind === "deactivated") {
    await closeSession(client);
  }
  if (visitor.kind !== "member") {
    throw redirect(buildSignInPath(request));
  }
  return visitor.member;
}

/** Lanza si quien pasó la guardia no es admin: el staff solo tiene la
 * pantalla del inicio (decisión 11 del PRD de W10a) y vuelve a ella. */
export function assertAdminMember(member: PanelMember, request: Request): void {
  if (member.role !== "admin") {
    throw redirect(getPanelPath("adminHome", getRequestLanguage(request)));
  }
}

/** La guardia del panel, para páginas y envíos por igual. Corre antes que
 * cualquier loader o action y deja el perfil de la persona en el contexto. */
export const requirePanelMember: MiddlewareFunction<Response> = async ({
  request,
  context,
}) => {
  const { client } = context.get(panelSessionContext);
  context.set(panelMemberContext, await verifyPanelMember(request, client));
};

/** Para las secciones del panel. Va debajo de `requirePanelMember`. */
export const requireAdmin: MiddlewareFunction<Response> = ({
  request,
  context,
}) => {
  assertAdminMember(context.get(panelMemberContext), request);
};
