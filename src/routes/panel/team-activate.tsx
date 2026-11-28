import type { ReactElement } from "react";

import { TeamListScreen } from "~/components/panel/team/team-list-screen";
import type { TeamListView } from "~/lib/admin/team";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { loadTeamList } from "~/lib/panel/load-team-list.server";
import { activateMember } from "~/lib/panel/team-member-changes.server";
import {
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/team-activate";

export function loader(args: Route.LoaderArgs): Promise<TeamListView> {
  return loadTeamList(args);
}

export const action = defineAdminAction({
  name: "profile.activate",
  auditedFields: ["is_active"],
  run: (args: Route.ActionArgs) => activateMember(args),
});

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

// Solo se pinta sin JavaScript: con él, el botón envía sin salir de la lista.
export default function TeamActivate({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <TeamListScreen
      {...loaderData}
      initialOutcome={withoutUnsent(actionData)}
    />
  );
}
