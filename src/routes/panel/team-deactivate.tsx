import type { ReactElement } from "react";

import { DeactivateConfirmation } from "~/components/panel/team/deactivate-confirmation";
import type { DeactivationView } from "~/lib/admin/team";
import { defineAdminAction } from "~/lib/panel/admin-action.server";
import { loadDeactivation } from "~/lib/panel/load-deactivation.server";
import { deactivateMember } from "~/lib/panel/team-member-changes.server";
import {
  sendPanelForm,
  withoutUnsent,
  type PanelSubmission,
} from "~/lib/panel/unsent-submission";

import type { Route } from "./+types/team-deactivate";

export function loader(args: Route.LoaderArgs): Promise<DeactivationView> {
  return loadDeactivation(args);
}

export const action = defineAdminAction({
  name: "profile.deactivate",
  auditedFields: ["is_active"],
  run: (args: Route.ActionArgs) => deactivateMember(args),
});

// Sin red, el envío se responde en el navegador y la pantalla no cambia.
export function clientAction({
  serverAction,
}: Route.ClientActionArgs): PanelSubmission<
  Awaited<ReturnType<typeof serverAction>>
> {
  return sendPanelForm(() => serverAction());
}

export default function TeamDeactivate({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <DeactivateConfirmation
      {...loaderData}
      initialOutcome={withoutUnsent(actionData)}
    />
  );
}
