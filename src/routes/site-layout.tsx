import type { ReactElement } from "react";
import { Outlet, useRouteLoaderData } from "react-router";

import { ErrorContent } from "~/components/error-content";
import { LanguageSuggestion } from "~/components/language-suggestion";
import { SiteShell } from "~/components/site-shell";
import { loadAnnouncementMessages } from "~/lib/announcement-bar.server";
import { getRequestLanguage } from "~/lib/i18n/languages";

import type { loader as rootLoader } from "../root";

import type { Route } from "./+types/site-layout";

function useCurrentYear(): number {
  const year = useRouteLoaderData<typeof rootLoader>("root")?.currentYear;
  if (year === undefined) {
    throw new Error("La raíz no entregó el año del pie.");
  }
  return year;
}

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

// La barra se vuelve a leer en cada navegación, no solo al cargar la página.
// Sin esto, pasar de `/` a `/en/` dejaría la barra en español: esta ruta
// no tiene parámetros y React Router no la revalidaría. El costo aceptado es
// una consulta por navegación, con el mismo límite de espera.
export function shouldRevalidate(): boolean {
  return true;
}

// Ruta de layout: no tiene dirección propia. Envuelve las páginas del sitio y
// el 404 para que ninguna declare el header.
export default function SiteLayout({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const year = useCurrentYear();
  return (
    <SiteShell
      announcements={loaderData.announcements}
      notice={<LanguageNotice />}
      year={year}
    >
      <Outlet />
    </SiteShell>
  );
}

// Un error de una página (el 404 incluido) sigue llevando la cáscara.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  const year = useCurrentYear();
  const announcements =
    useRouteLoaderData<typeof loader>("routes/site-layout")?.announcements;
  return (
    <SiteShell
      announcements={announcements}
      notice={<LanguageNotice />}
      year={year}
    >
      <ErrorContent error={error} />
    </SiteShell>
  );
}
