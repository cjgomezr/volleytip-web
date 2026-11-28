import type { ReactElement } from "react";

import { TeamListScreen } from "~/components/panel/team/team-list-screen";
import type { TeamListView } from "~/lib/admin/team";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { loadTeamList } from "~/lib/panel/load-team-list.server";
import { activateMember } from "~/lib/panel/team-member-changes.server";

import type { Route } from "./+types/team-activate";

export { TeamErrorBoundary as ErrorBoundary } from "~/components/panel/team/team-error";

export function loader(args: Route.LoaderArgs): Promise<TeamListView> {
  return loadTeamList(args);
}

export const action = defineAdminAction({
  name: "profile.activate",
  auditedFields: ["is_active"],
  run: (args: Route.ActionArgs) => activateMember(args),
});

// Solo se pinta sin JavaScript: con él, el botón envía sin salir de la lista.
export default function TeamActivate({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <TeamListScreen {...loaderData} initialOutcome={actionData} />;
}
