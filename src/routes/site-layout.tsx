import type { ReactElement } from "react";
import { Link, Outlet, useRouteLoaderData } from "react-router";

import {
  ErrorContent,
  isServerError,
  ServerErrorPage,
} from "~/components/error-content";
import { LanguageSuggestion } from "~/components/language-suggestion";
import { SiteShell } from "~/components/site-shell";
import { pickAnnouncementMessages } from "~/lib/announcement-bar.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { PAGES } from "~/lib/i18n/pages";
import { siteSettingsContext } from "~/lib/site-settings.server";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { getMenuEntries } from "~/lib/site-menu";

import type { loader as rootLoader } from "../root";

import type { Route } from "./+types/site-layout";

// 44 px de alto como mínimo: zona de toque en celular.
const SECTION_LINK_STYLES =
  "inline-flex min-h-11 items-center px-1 text-[14px] font-bold underline hovered:text-brand-lime transition-colors motion-reduce:transition-none";

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

// La barra sale de los ajustes que el middleware de la raíz ya leyó, junto
// con el modo mantenimiento, en una sola consulta.
export function loader({
  request,
  context,
}: Route.LoaderArgs): { readonly announcements: string[] } {
  return {
    announcements: pickAnnouncementMessages(
      context.get(siteSettingsContext).announcements,
      getRequestLanguage(request),
    ),
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

// Los enlaces del 404 a las secciones que ya existen en el mapa de páginas.
// Una sección que todavía no tiene página no se pinta.
function SectionLinks(): ReactElement {
  const translate = useTranslate();
  const entries = getMenuEntries(PAGES, useLanguage());
  return (
    <>
      {entries.map((entry) => (
        <Link key={entry.id} to={entry.href} className={SECTION_LINK_STYLES}>
          {translate(entry.labelKey)}
        </Link>
      ))}
    </>
  );
}

function ErrorInShell({ error }: { readonly error: unknown }): ReactElement {
  const year = useCurrentYear();
  const announcements =
    useRouteLoaderData<typeof loader>("routes/site-layout")?.announcements;
  return (
    <SiteShell
      announcements={announcements}
      notice={<LanguageNotice />}
      year={year}
    >
      <ErrorContent error={error}>
        <SectionLinks />
      </ErrorContent>
    </SiteShell>
  );
}

// El 404 y las respuestas de error controladas siguen llevando la cáscara.
// El 500 no: lo pinta la misma página que usa la raíz, sin leer ajustes.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  return isServerError(error) ? (
    <ServerErrorPage />
  ) : (
    <ErrorInShell error={error} />
  );
}
