import type { ReactElement } from "react";
import { Outlet, useRouteLoaderData } from "react-router";

import { ErrorContent } from "~/components/error-content";
import { LanguageSuggestion } from "~/components/language-suggestion";
import { SiteShell } from "~/components/site-shell";
import { loadAnnouncementMessages } from "~/lib/announcement-bar.server";
import { getRequestLanguage } from "~/lib/i18n/languages";

import type { loader as rootLoader } from "../root";

import type { Route } from "./+types/site-layout";

function LanguageNotice(): ReactElement | null {
  const suggestion =
    useRouteLoaderData<typeof rootLoader>("root")?.languageSuggestion;
  return suggestion ? <LanguageSuggestion {...suggestion} /> : null;
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<{ readonly announcements: string[] }> {
  return {
    announcements: await loadAnnouncementMessages(getRequestLanguage(request)),
  };
}

// La barra se lee de la base en cada petición y también en cada navegación,
// para que un cambio del ajuste y el cambio de idioma se vean al momento.
export function shouldRevalidate(): boolean {
  return true;
}

// Ruta de layout: no tiene dirección propia. Envuelve las páginas del sitio y
// el 404 para que ninguna declare el header.
export default function SiteLayout({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return (
    <SiteShell
      announcements={loaderData.announcements}
      notice={<LanguageNotice />}
    >
      <Outlet />
    </SiteShell>
  );
}

// Un error de una página (el 404 incluido) sigue llevando la cáscara.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  const announcements =
    useRouteLoaderData<typeof loader>("routes/site-layout")?.announcements;
  return (
    <SiteShell announcements={announcements} notice={<LanguageNotice />}>
      <ErrorContent error={error} />
    </SiteShell>
  );
}
