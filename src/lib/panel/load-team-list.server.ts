import type { LoaderFunctionArgs } from "react-router";

import type { TeamListView } from "../admin/team";
import { getRequestLanguage } from "../i18n/languages";
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
  return readTeamList(client, {
    language: getRequestLanguage(request),
    url: new URL(request.url),
    viewerId: viewer.id,
  });
}
