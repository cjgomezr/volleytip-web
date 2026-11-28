import type { ReactElement } from "react";

import type { SampleTeam } from "~/lib/admin/sample-team";

import { DeactivateConfirmation } from "./deactivate-confirmation";
import { TeamInviteScreen } from "./team-invite-screen";
import { TeamListScreen } from "./team-list-screen";

/** La pantalla de un estado de muestra del equipo. */
export function SampleTeamScreen(sample: SampleTeam): ReactElement {
  switch (sample.screen) {
    case "list":
      return (
        <TeamListScreen {...sample.view} initialOutcome={sample.outcome} />
      );
    case "invite":
      return <TeamInviteScreen outcome={sample.outcome} />;
    case "confirmation":
      return (
        <DeactivateConfirmation {...sample.view} outcome={sample.outcome} />
      );
  }
}
