import type { ReactElement, ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import { LanguageAlternates } from "~/components/language-alternates";
import {
  LanguageSuggestion,
  type LanguageSuggestionTexts,
} from "~/components/language-suggestion";
import { serverEnv } from "~/lib/env.server";
import { redirectFromDefaultPrefix } from "~/lib/i18n/default-language-redirect";
import {
  addVaryHeaders,
  getLanguageProposal,
  redirectRootToChosenLanguage,
} from "~/lib/i18n/language-choice.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getMessages, getTranslate } from "~/lib/i18n/messages.server";
import { getPageAtPath } from "~/lib/i18n/pages";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import type { Messages } from "~/lib/i18n/translate";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { markAsNotIndexable } from "~/lib/indexing.server";

import type { Route } from "./+types/root";
import "./app.css";

const NOT_FOUND_STATUS = 404;

// El único lugar que pone `X-Robots-Tag`. Al estar en la ruta raíz envuelve
// las respuestas de todas las rutas: páginas, datos, rutas de recurso y
// errores. Queda fuera lo que React Router rechaza antes de buscar una ruta
// (un método como OPTIONS), que no es contenido que un buscador indexe.
// Las páginas dependen de la cookie de idioma y de `Accept-Language`
// (el aviso de idioma), y la raíz redirige según la cookie. Las demás
// respuestas no cambian con eso.
function declareLanguageVariation(
  request: Request,
  response: Response,
): Response {
  const { pathname } = new URL(request.url);
  return getPageAtPath(pathname) === undefined
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

const markResponseAsNotIndexable: Route.MiddlewareFunction = async (
  { request },
  next,
) => {
  const response = await respondWithLanguageChoice(request, next);
  return markAsNotIndexable(response, serverEnv.appEnv);
};

export const middleware: Route.MiddlewareFunction[] = [
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
  readonly languageSuggestion: LanguageSuggestionData | null;
}> {
  return {
    messages: getMessages(getRequestLanguage(request)),
    siteOrigin: serverEnv.siteOrigin,
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
      {loaderData.languageSuggestion === null ? null : (
        <LanguageSuggestion {...loaderData.languageSuggestion} />
      )}
      <Outlet />
    </>
  );
}

interface ErrorSummary {
  readonly title: string;
  readonly details: string;
}

// No usa `useTranslate`: los textos de la raíz pueden faltar justo cuando
// hay que pintar un error (un fallo en el middleware o en el loader de la
// raíz, un método que React Router rechaza). Los de la página de error
// viajan siempre con el código.
function useErrorSummary(error: unknown): ErrorSummary {
  const messages = ERROR_MESSAGES[useLanguage()];
  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    return {
      title: messages["error.notFoundTitle"],
      details: messages["error.notFoundDetails"],
    };
  }
  if (import.meta.env.DEV && error instanceof Error) {
    return { title: messages["error.genericTitle"], details: error.message };
  }
  return {
    title: messages["error.genericTitle"],
    details: messages["error.genericDetails"],
  };
}

// Límite de error provisional. Las páginas 404, 500 y mantenimiento del
// diseño (FR-056) llegan con W3.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  const { title, details } = useErrorSummary(error);

  return (
    <main className="mx-auto max-w-[1280px] px-6 pt-12 pb-24">
      <h1 className="font-display text-[56px] leading-[0.95] uppercase">
        {title}
      </h1>
      <p className="mt-6 text-[16px] leading-[1.5] text-ink-muted">{details}</p>
    </main>
  );
}
