import type { ReactElement } from "react";

import { TeamInviteScreen } from "~/components/panel/team/team-invite-screen";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { inviteMember } from "~/lib/panel/team-invite.server";
import {
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/team-invite";

export const action = defineAdminAction({
  name: "profile.invite",
  auditedFields: ["role", "is_active", "full_name"],
  run: (args: Route.ActionArgs) => inviteMember(args),
});

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

export default function TeamInvite({
  actionData,
}: Route.ComponentProps): ReactElement {
  return <TeamInviteScreen initialOutcome={withoutUnsent(actionData)} />;
}
