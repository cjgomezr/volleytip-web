import { data, redirect, type LoaderFunctionArgs } from "react-router";

import type { DeactivationView } from "../admin/team";
import { getRequestLanguage } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import {
  panelSessionContext,
  verifyAdminMember,
} from "./panel-middleware.server";
import { readTeamMember } from "./team-reader.server";

const NOT_FOUND_STATUS = 404;

/** A quién se va a desactivar. Si no hay nada que confirmar (es quien mira o
 * ya está desactivado), vuelve a la lista. */
export async function loadDeactivation({
  request,
  context,
  params,
}: LoaderFunctionArgs): Promise<DeactivationView> {
  const { client } = context.get(panelSessionContext);
  const viewer = await verifyAdminMember(request, client);
  const memberId = (params.memberId ?? "").toLowerCase();
  const member = await readTeamMember(client, memberId);
  if (member === null) throw data(null, { status: NOT_FOUND_STATUS });
  if (member.id === viewer.id || !member.isActive) {
    throw redirect(getPanelPath("adminTeam", getRequestLanguage(request)));
  }
  const { id, name, email } = member;
  return { member: { id, name, email } };
}
