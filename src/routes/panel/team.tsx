import type { ReactElement } from "react";

import { TeamListScreen } from "~/components/panel/team/team-list-screen";
import type { TeamListView } from "~/lib/admin/team";
import { loadTeamList } from "~/lib/panel/load-team-list.server";

import type { Route } from "./+types/team";

// El fallo de un botón de la lista llega aquí: el envío es de esta ruta.
export { TeamErrorBoundary as ErrorBoundary } from "~/components/panel/team/team-error";

export function loader(args: Route.LoaderArgs): Promise<TeamListView> {
  return loadTeamList(args);
}

export default function Team({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <TeamListScreen {...loaderData} />;
}
