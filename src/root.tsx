import type { ReactElement, ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import { MaintenancePage } from "~/components/maintenance-page";
import {
  ErrorContent,
  isServerError,
  ServerErrorPage,
} from "~/components/error-content";
import { LanguageAlternates } from "~/components/language-alternates";
import type { LanguageSuggestionTexts } from "~/components/language-suggestion";
import { serverEnv } from "~/lib/env.server";
import { redirectFromDefaultPrefix } from "~/lib/i18n/default-language-redirect";
import { getDocumentPath } from "~/lib/i18n/document-path";
import {
  addVaryHeaders,
  getLanguageProposal,
  redirectRootToChosenLanguage,
} from "~/lib/i18n/language-choice.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getSiteYear } from "~/lib/i18n/format";
import { getMessages, getTranslate } from "~/lib/i18n/messages.server";
import { getPageAtPath } from "~/lib/i18n/pages";
import type { Messages } from "~/lib/i18n/translate";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { markAsNotIndexable } from "~/lib/indexing.server";
import { enforceMaintenanceMode } from "~/lib/maintenance-middleware.server";
import { findMaintenanceNotice } from "~/lib/maintenance-notice";

import type { Route } from "./+types/root";
import "./app.css";

// Las páginas dependen de la cookie de idioma y de `Accept-Language`
// (el aviso de idioma), y la raíz redirige según la cookie. Las demás
// respuestas no cambian con eso. Vale también para los datos que React Router
// pide al navegar (`/_.data`), que llevan el mismo aviso.
function declareLanguageVariation(
  request: Request,
  response: Response,
): Response {
  const pagePath = getDocumentPath(new URL(request.url));
  return getPageAtPath(pagePath) === undefined
    ? response
    : addVaryHeaders(response);
}

async function respondWithLanguageChoice(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const redirect =
    redirectFromDefaultPrefix(new URL(request.url)) ??
    (await redirectRootToChosenLanguage(request));
  if (redirect !== null) return addVaryHeaders(redirect);
  return declareLanguageVariation(request, await next());
}

// El único lugar que pone `X-Robots-Tag`. Al estar en la ruta raíz envuelve
// las respuestas de todas las rutas: páginas, datos, rutas de recurso y
// errores. Queda fuera lo que React Router rechaza antes de buscar una ruta
// (un método como OPTIONS), que no es contenido que un buscador indexe.
const markResponseAsNotIndexable: Route.MiddlewareFunction = async (
  { request },
  next,
) => {
  const response = await respondWithLanguageChoice(request, next);
  return markAsNotIndexable(response, serverEnv.appEnv);
};

// Va primero: con el modo mantenimiento encendido la petición se corta antes
// de redirigir por idioma y antes de que corra ningún loader o action.
export const middleware: Route.MiddlewareFunction[] = [
  enforceMaintenanceMode,
  markResponseAsNotIndexable,
];

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/brand/mark.png" },
];

// Al navegador solo llegan los textos del idioma de la página. En modo
// framework con SSR, React Router vuelve a pedir este loader en cada
// navegación, así que al pasar de `/` a `/en/` los textos cambian con el
// idioma. Lo vigila una prueba de Playwright.
// `siteOrigin` no es un secreto: es el dominio público, y el navegador lo
// necesita para pintar las mismas direcciones que el servidor.
interface LanguageSuggestionData {
  readonly proposed: Language;
  readonly pageLanguage: Language;
  readonly texts: LanguageSuggestionTexts;
}

// Los textos del aviso van en el idioma que propone, no en el de la página:
// es el que lee quien lo recibe.
async function loadLanguageSuggestion(
  request: Request,
): Promise<LanguageSuggestionData | null> {
  const proposed = await getLanguageProposal(request);
  if (proposed === undefined) return null;
  const translate = getTranslate(proposed);
  return {
    proposed,
    pageLanguage: getRequestLanguage(request),
    texts: {
      label: translate("languageSuggestion.label"),
      message: translate("languageSuggestion.message"),
      accept: translate("languageSuggestion.accept"),
      stay: translate("languageSuggestion.stay"),
    },
  };
}

export async function loader({ request }: Route.LoaderArgs): Promise<{
  readonly messages: Messages;
  readonly siteOrigin: string;
  readonly currentYear: number;
  readonly languageSuggestion: LanguageSuggestionData | null;
}> {
  return {
    messages: getMessages(getRequestLanguage(request)),
    siteOrigin: serverEnv.siteOrigin,
    currentYear: getSiteYear(new Date()),
    languageSuggestion: await loadLanguageSuggestion(request),
  };
}

export function Layout({ children }: { children: ReactNode }): ReactElement {
  const language = useLanguage();
  const rootData = useRouteLoaderData<typeof loader>("root");

  return (
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {rootData === undefined ? (
          children
        ) : (
          <TranslationsProvider
            language={language}
            messages={rootData.messages}
          >
            {children}
          </TranslationsProvider>
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Las direcciones para buscadores se pintan aquí y no en `Layout`: este
// componente no se pinta cuando la página es un error (lo hace
// `ErrorBoundary`), así que un 404 sale sin canónica ni `hreflang`.
export default function App({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return (
    <>
      <LanguageAlternates siteOrigin={loaderData.siteOrigin} />
      <Outlet />
    </>
  );
}

// Respaldo para cuando falla la raíz o el layout del sitio, y la página del
// 500: sin textos ni header, para que se pinte aunque lo que falló fuera leer
// la base. El 404 y los errores controlados de una página los pinta el límite
// de `site-layout.tsx`, con la cáscara.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  const maintenance = findMaintenanceNotice(error);
  if (maintenance !== undefined) {
    return <MaintenancePage returnsAt={maintenance.returnsAt} />;
  }
  if (isServerError(error)) return <ServerErrorPage />;
  return (
    <main>
      <ErrorContent error={error} />
    </main>
  );
}
