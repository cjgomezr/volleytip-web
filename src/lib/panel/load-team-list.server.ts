import type { LoaderFunctionArgs } from "react-router";

import type { TeamListView } from "../admin/team";
import { serverEnv } from "../env.server";
import { getRequestLanguage } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import {
  panelSessionContext,
  verifyAdminMember,
} from "./panel-middleware.server";
import { readTeamList } from "./team-reader.server";

/** El loader de la lista y de las rutas de sus botones, que sin JavaScript la
 * vuelven a pintar. Comprueba aquí que quien pide sea admin, porque la lista
 * lee con la llave de servicio. */
export async function loadTeamList({
  request,
  context,
}: LoaderFunctionArgs): Promise<TeamListView> {
  const { client } = context.get(panelSessionContext);
  const viewer = await verifyAdminMember(request, client);
  const language = getRequestLanguage(request);
  const signInPath = getPanelPath("adminSignIn", language);
  return readTeamList(client, {
    language,
    signInUrl: new URL(signInPath, serverEnv.siteOrigin).href,
    url: new URL(request.url),
    viewerId: viewer.id,
  });
}
