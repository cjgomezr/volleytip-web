import { buildPanelNotFound } from "~/lib/panel/panel-not-found.server";

import type { Route } from "./+types/missing";

// Comodín del panel. Sin él, una dirección bajo `/admin` que no existe caería
// en el comodín del sitio, que no pasa por la guardia: sin sesión tiene que
// llevar a la entrada, como las demás.
export async function loader({ request }: Route.LoaderArgs): Promise<never> {
  throw await buildPanelNotFound(request);
}

export async function action({ request }: Route.ActionArgs): Promise<never> {
  throw await buildPanelNotFound(request);
}

// Nunca se pinta: lo que se ve lo pinta el `ErrorBoundary` de la raíz.
export default function PanelMissing(): null {
  return null;
}
