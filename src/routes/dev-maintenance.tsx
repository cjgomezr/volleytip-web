import type { ReactElement } from "react";
import { data } from "react-router";

import { MaintenancePage } from "~/components/maintenance-page";
import { serverEnv } from "~/lib/env.server";

import type { Route } from "./+types/dev-maintenance";

// Pinta la página de mantenimiento sin encender el modo, para capturarla en
// Playwright. Con `?hora=<ISO>` muestra la hora de regreso. En producción
// responde 404.
const NOT_FOUND_STATUS = 404;

export function loader({ request }: Route.LoaderArgs): {
  readonly returnsAt: string | null;
} {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  return { returnsAt: new URL(request.url).searchParams.get("hora") };
}

export default function DevMaintenance({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <MaintenancePage returnsAt={loaderData.returnsAt} />;
}
