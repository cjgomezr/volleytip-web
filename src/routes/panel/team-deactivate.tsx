import type { ReactElement } from "react";

import { DeactivateConfirmation } from "~/components/panel/team/deactivate-confirmation";
import type { DeactivationView } from "~/lib/admin/team";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { loadDeactivation } from "~/lib/panel/load-deactivation.server";
import { deactivateMember } from "~/lib/panel/team-member-changes.server";

import type { Route } from "./+types/team-deactivate";

export { TeamErrorBoundary as ErrorBoundary } from "~/components/panel/team/team-error";

export function loader(args: Route.LoaderArgs): Promise<DeactivationView> {
  return loadDeactivation(args);
}

export const action = defineAdminAction({
  name: "profile.deactivate",
  auditedFields: ["is_active"],
  run: (args: Route.ActionArgs) => deactivateMember(args),
});

export default function TeamDeactivate({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <DeactivateConfirmation {...loaderData} outcome={actionData} />;
}
