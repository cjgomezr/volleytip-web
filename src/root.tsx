import type { ReactElement, ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteError,
  useRouteLoaderData,
} from "react-router";

import { LanguageAlternates } from "~/components/language-alternates";
import { RootError } from "~/components/root-error";
import { activeLanguagesContext } from "~/lib/active-languages.server";
import { serverEnv } from "~/lib/env.server";
import type { ActiveLanguages } from "~/lib/i18n/active-languages";
import { ActiveLanguagesProvider } from "~/lib/i18n/active-languages-context";
import { readDocumentLanguages } from "~/lib/i18n/document-languages";
import { redirectFromDefaultPrefix } from "~/lib/i18n/default-language-redirect";
import { getDocumentPath } from "~/lib/i18n/document-path";
import {
  addVaryHeaders,
  redirectRootToChosenLanguage,
} from "~/lib/i18n/language-choice.server";
import {
  loadLanguageSuggestion,
  type LanguageSuggestionData,
} from "~/lib/i18n/language-suggestion.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getSiteYear } from "~/lib/i18n/format";
import { getMessages } from "~/lib/i18n/messages.server";
import { getPageAtPath } from "~/lib/i18n/pages";
import type { Messages } from "~/lib/i18n/translate";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { enforceSiteAvailability } from "~/lib/language-middleware.server";
import { markAsNotIndexable } from "~/lib/indexing.server";

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
  activeLanguages: ActiveLanguages,
  next: () => Promise<Response>,
): Promise<Response> {
  const redirect =
    redirectFromDefaultPrefix(new URL(request.url)) ??
    (await redirectRootToChosenLanguage(request, activeLanguages));
  if (redirect !== null) return addVaryHeaders(redirect);
  return declareLanguageVariation(request, await next());
}

// El único lugar que pone `X-Robots-Tag`. Al ser el primero de la ruta raíz
// envuelve las respuestas de todas las rutas: páginas, datos, rutas de recurso
// y errores, también los que lanzan los middleware de abajo. Queda fuera lo que
// React Router rechaza antes de buscar una ruta (un método como OPTIONS), que
// no es contenido que un buscador indexe.
const markResponseAsNotIndexable: Route.MiddlewareFunction = async (
  _args,
  next,
) => markAsNotIndexable((await next()) as Response, serverEnv.appEnv);

const applyLanguageChoice: Route.MiddlewareFunction = (
  { request, context },
  next,
) =>
  respondWithLanguageChoice(
    request,
    context.get(activeLanguagesContext),
    next as () => Promise<Response>,
  );

// El orden importa: con el modo mantenimiento encendido, o en un idioma
// desactivado, la petición se corta antes de redirigir por idioma y antes de
// que corra ningún loader o action.
export const middleware: Route.MiddlewareFunction[] = [
  markResponseAsNotIndexable,
  enforceSiteAvailability,
  applyLanguageChoice,
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
export async function loader({ request, context }: Route.LoaderArgs): Promise<{
  readonly activeLanguages: ActiveLanguages;
  readonly messages: Messages;
  readonly siteOrigin: string;
  readonly currentYear: number;
  readonly languageSuggestion: LanguageSuggestionData | null;
}> {
  const activeLanguages = context.get(activeLanguagesContext);
  return {
    activeLanguages,
    messages: getMessages(getRequestLanguage(request)),
    siteOrigin: serverEnv.siteOrigin,
    currentYear: getSiteYear(new Date()),
    languageSuggestion: await loadLanguageSuggestion(request, activeLanguages),
  };
}

export function Layout({ children }: { children: ReactNode }): ReactElement {
  const rootData = useRouteLoaderData<typeof loader>("root");
  const error = useRouteError();
  const { activeLanguages, language, forcedLanguage } = readDocumentLanguages({
    pathname: useLocation().pathname,
    error,
    rootLanguages: rootData?.activeLanguages,
  });

  return (
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ActiveLanguagesProvider
          languages={activeLanguages}
          forcedLanguage={forcedLanguage}
        >
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
        </ActiveLanguagesProvider>
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
// la base.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  return <RootError error={error} />;
}
