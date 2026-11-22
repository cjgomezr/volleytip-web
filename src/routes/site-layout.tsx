import type { ReactElement } from "react";
import { Outlet, useRouteLoaderData } from "react-router";

import { ErrorContent } from "~/components/error-content";
import { LanguageSuggestion } from "~/components/language-suggestion";
import { SiteShell } from "~/components/site-shell";

import type { loader as rootLoader } from "../root";

import type { Route } from "./+types/site-layout";

function LanguageNotice(): ReactElement | null {
  const suggestion =
    useRouteLoaderData<typeof rootLoader>("root")?.languageSuggestion;
  return suggestion ? <LanguageSuggestion {...suggestion} /> : null;
}

// Ruta de layout: no tiene dirección propia. Envuelve las páginas del sitio y
// el 404 para que ninguna declare el header.
export default function SiteLayout(): ReactElement {
  return (
    <SiteShell notice={<LanguageNotice />}>
      <Outlet />
    </SiteShell>
  );
}

// Un error de una página (el 404 incluido) sigue llevando la cáscara.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  return (
    <SiteShell notice={<LanguageNotice />}>
      <ErrorContent error={error} />
    </SiteShell>
  );
}
