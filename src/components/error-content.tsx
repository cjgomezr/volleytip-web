import type { ReactElement, ReactNode } from "react";
import { isRouteErrorResponse, useLocation } from "react-router";

import { useReferenceCode } from "~/lib/error-reference";
import { getPagePath } from "~/lib/i18n/pages";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { useLanguage } from "~/lib/i18n/use-language";

import { Button } from "./button";
import {
  OUTLINE_INTERACTIVE_STYLES,
  OUTLINE_ZONE_STYLES,
  TRANSITION_STYLES,
} from "./pressable-styles";

const NOT_FOUND_STATUS = 404;
const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

const PAGE_STYLES = "mx-auto max-w-[1280px] px-6 pt-12 pb-24";
const TITLE_STYLES =
  "font-display text-[56px] leading-[0.95] uppercase md:text-[88px]";
const DETAILS_STYLES = "mt-6 max-w-[56ch] text-[16px] leading-[1.5]";
const ACTIONS_STYLES = "mt-8 flex flex-wrap items-center gap-4";
const RETRY_STYLES = `inline-flex min-h-[50px] max-w-full items-center justify-center rounded-pill border-2 bg-transparent px-6 py-2 text-center text-[16px] leading-tight font-bold no-underline ${OUTLINE_ZONE_STYLES.dark} ${OUTLINE_INTERACTIVE_STYLES.dark} ${TRANSITION_STYLES}`;

type ErrorKind = "notFound" | "server" | "other";

function classifyError(error: unknown): ErrorKind {
  // Una respuesta de ruta (400, 403, 404...) es una decisión de la app y
  // conserva su estado. Todo lo demás es un fallo no controlado.
  if (!isRouteErrorResponse(error)) return "server";
  if (error.status === NOT_FOUND_STATUS) return "notFound";
  return "other";
}

/**
 * Un error no controlado o una respuesta 5xx. Esta página no lleva la cáscara
 * del sitio: se pinta aunque el fallo haya sido justo en leer los ajustes.
 */
export function isServerError(error: unknown): boolean {
  return classifyError(error) === "server";
}

// No usa `useTranslate`: los textos de la raíz pueden faltar justo cuando
// hay que pintar un error (un fallo en el middleware o en el loader de la
// raíz, un método que React Router rechaza). Los de las páginas de error
// viajan siempre con el código.
function useErrorMessages(): (typeof ERROR_MESSAGES)[keyof typeof ERROR_MESSAGES] {
  return ERROR_MESSAGES[useLanguage()];
}

function NoIndex(): ReactElement {
  return <meta name="robots" content="noindex, nofollow" />;
}

/**
 * La página de un 404 o de otra respuesta de error controlada (400, 403),
 * para ponerla dentro de un `<main>`. `children` son enlaces extra, junto al
 * de la home.
 */
export function ErrorContent({
  error,
  children,
}: {
  readonly error: unknown;
  readonly children?: ReactNode;
}): ReactElement {
  const messages = useErrorMessages();
  const isNotFound = classifyError(error) === "notFound";
  const title = isNotFound
    ? messages["error.notFoundTitle"]
    : messages["error.genericTitle"];
  const details = isNotFound
    ? messages["error.notFoundDetails"]
    : messages["error.genericDetails"];
  return (
    <div className={PAGE_STYLES}>
      <title>{title}</title>
      <NoIndex />
      <h1 className={TITLE_STYLES}>{title}</h1>
      <p className={`${DETAILS_STYLES} text-ink-muted`}>{details}</p>
      <div className={ACTIONS_STYLES}>
        <Button to="home">{messages["error.homeLink"]}</Button>
        {children}
      </div>
    </div>
  );
}

/**
 * La página del 500. Lleva el logo con enlace a la home pero no el header ni
 * la barra de anuncios, que leen la base. Nunca muestra el mensaje ni la
 * traza del error: solo el código de referencia que quedó en el registro.
 */
export function ServerErrorPage(): ReactElement {
  const messages = useErrorMessages();
  const language = useLanguage();
  const { pathname, search } = useLocation();
  const referenceCode = useReferenceCode();
  return (
    <main className={PAGE_STYLES}>
      <title>{messages["error.serverTitle"]}</title>
      <NoIndex />
      <a
        href={getPagePath("home", language)}
        aria-label={messages["error.homeLinkLabel"]}
      >
        <img
          src="/brand/wordmark.png"
          alt=""
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          className="mb-12 h-[30px] w-auto"
        />
      </a>
      <h1 className={TITLE_STYLES}>{messages["error.serverTitle"]}</h1>
      <p className={DETAILS_STYLES}>{messages["error.serverDetails"]}</p>
      {/* El navegador no conoce el código, pero la estructura tiene que ser la
          misma que pintó el servidor: el texto del código se deja como vino. */}
      <p className="mt-6 text-[14px] text-ink-muted">
        {messages["error.serverReference"]}:{" "}
        <strong suppressHydrationWarning>{referenceCode ?? ""}</strong>
      </p>
      <div className={ACTIONS_STYLES}>
        <a href={`${pathname}${search}`} className={RETRY_STYLES}>
          {messages["error.serverRetry"]}
        </a>
        <Button to="home">{messages["error.homeLink"]}</Button>
      </div>
    </main>
  );
}
