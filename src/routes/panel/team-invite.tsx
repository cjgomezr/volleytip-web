import type { ReactElement } from "react";

import { TeamInviteScreen } from "~/components/panel/team/team-invite-screen";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { inviteMember } from "~/lib/panel/team-invite.server";

import type { Route } from "./+types/team-invite";

export { TeamErrorBoundary as ErrorBoundary } from "~/components/panel/team/team-error";

export const action = defineAdminAction({
  name: "profile.invite",
  auditedFields: ["role", "is_active", "full_name"],
  run: (args: Route.ActionArgs) => inviteMember(args),
});

export default function TeamInvite({
  actionData,
}: Route.ComponentProps): ReactElement {
  return <TeamInviteScreen outcome={actionData} />;
}
