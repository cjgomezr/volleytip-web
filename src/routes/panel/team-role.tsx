import type { ReactElement } from "react";

import { TeamListScreen } from "~/components/panel/team/team-list-screen";
import type { TeamListView } from "~/lib/admin/team";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { loadTeamList } from "~/lib/panel/load-team-list.server";
import { changeMemberRole } from "~/lib/panel/team-member-changes.server";

import type { Route } from "./+types/team-role";

export { TeamErrorBoundary as ErrorBoundary } from "~/components/panel/team/team-error";

export function loader(args: Route.LoaderArgs): Promise<TeamListView> {
  return loadTeamList(args);
}

export const action = defineAdminAction({
  name: "profile.change_role",
  auditedFields: ["role"],
  run: (args: Route.ActionArgs) => changeMemberRole(args),
});

// Solo se pinta sin JavaScript: con él, el botón envía sin salir de la lista.
export default function TeamRole({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <TeamListScreen {...loaderData} initialOutcome={actionData} />;
}
