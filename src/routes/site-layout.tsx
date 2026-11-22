import type { ReactElement } from "react";
import { Outlet } from "react-router";

import { ErrorContent } from "~/components/error-content";
import { SiteShell } from "~/components/site-shell";

import type { Route } from "./+types/site-layout";

// Ruta de layout: no tiene dirección propia. Envuelve las páginas del sitio y
// el 404 para que ninguna declare el header.
export default function SiteLayout(): ReactElement {
  return (
    <SiteShell>
      <Outlet />
    </SiteShell>
  );
}

// Un error de una página (el 404 incluido) sigue llevando la cáscara.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  return (
    <SiteShell>
      <ErrorContent error={error} />
    </SiteShell>
  );
}
