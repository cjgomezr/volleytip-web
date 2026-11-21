import type { ReactElement, ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { serverEnv } from "~/lib/env.server";
import { redirectFromDefaultPrefix } from "~/lib/i18n/default-language-redirect";
import { useLanguage } from "~/lib/i18n/use-language";
import { markAsNotIndexable } from "~/lib/indexing.server";

import type { Route } from "./+types/root";
import "./app.css";

const NOT_FOUND_STATUS = 404;

// El único lugar que pone `X-Robots-Tag`. Al estar en la ruta raíz envuelve
// las respuestas de todas las rutas: páginas, datos, rutas de recurso y
// errores. Queda fuera lo que React Router rechaza antes de buscar una ruta
// (un método como OPTIONS), que no es contenido que un buscador indexe.
const markResponseAsNotIndexable: Route.MiddlewareFunction = async (
  { request },
  next,
) => {
  const redirect = redirectFromDefaultPrefix(new URL(request.url));
  return markAsNotIndexable(redirect ?? (await next()), serverEnv.appEnv);
};

export const middleware: Route.MiddlewareFunction[] = [
  markResponseAsNotIndexable,
];

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/brand/mark.png" },
];

export function Layout({ children }: { children: ReactNode }): ReactElement {
  const language = useLanguage();

  return (
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): ReactElement {
  return <Outlet />;
}

interface ErrorSummary {
  readonly title: string;
  readonly details: string;
}

function summarizeError(error: unknown): ErrorSummary {
  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    return { title: "404", details: "Esta página no existe." };
  }
  if (import.meta.env.DEV && error instanceof Error) {
    return { title: "Error", details: error.message };
  }
  return { title: "Error", details: "Algo salió mal. Intenta de nuevo." };
}

// Límite de error provisional. Las páginas 404, 500 y mantenimiento del
// diseño (FR-056) llegan con W3.
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  const { title, details } = summarizeError(error);

  return (
    <main className="mx-auto max-w-[1280px] px-6 pt-12 pb-24">
      <h1 className="font-display text-[56px] leading-[0.95] uppercase">
        {title}
      </h1>
      <p className="mt-6 text-[16px] leading-[1.5] text-ink-muted">{details}</p>
    </main>
  );
}
