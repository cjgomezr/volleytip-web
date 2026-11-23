import type { ReactElement, ReactNode } from "react";
import { isRouteErrorResponse, useLocation } from "react-router";

import { useReferenceCode } from "~/lib/error-reference";
import { getPagePath } from "~/lib/i18n/pages";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { useLanguage } from "~/lib/i18n/use-language";

import { Button } from "./button";
import { LocalizedLink } from "./localized-link";
import { TRANSITION_STYLES } from "./pressable-styles";

const NOT_FOUND_STATUS = 404;
const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

const SERVER_ERROR_STATUS = 500;

const PAGE_STYLES = "mx-auto max-w-[1280px] px-6";
// El bloque se centra en el alto que deja la cáscara, como en el mockup.
const CENTERED_STYLES = `${PAGE_STYLES} flex min-h-[60vh] flex-col justify-center py-12`;
// El número es decoración: sale de un pseudo-elemento para que no cuente como
// texto (el lector de pantalla ya oye el h1 y axe no mide su contraste).
const CODE_STYLES =
  "m-0 before:content-[attr(data-code)] font-display text-[clamp(120px,20vw,260px)] leading-[0.85] uppercase";
const SOLID_CODE_STYLES = `${CODE_STYLES} text-brand-red`;
// Relleno índigo y contorno rojo, como el 500 del mockup.
const OUTLINED_CODE_STYLES = `${CODE_STYLES} text-brand-indigo [-webkit-text-stroke:3px_var(--color-brand-red)]`;
const TITLE_STYLES =
  "mt-4 font-display text-[40px] leading-[1.05] uppercase md:text-[56px]";
const DETAILS_STYLES = "mt-6 max-w-[56ch] text-[16px] leading-[1.5]";
const ACTIONS_STYLES = "mt-8 flex flex-wrap items-center gap-4";
const PAGE_LINK_STYLES = `inline-flex min-h-11 items-center px-1 text-[14px] font-bold underline hovered:text-brand-lime ${TRANSITION_STYLES}`;
// El relleno lateral agranda la zona de toque. El margen negativo deja el
// texto del primer enlace alineado con el título.
const HOME_LINK_STYLES = `${PAGE_LINK_STYLES} -ml-1`;
// 44 px de zona de toque alrededor de un logo de 30 px, sin mover el logo.
const LOGO_LINK_STYLES =
  "-my-[7px] inline-flex min-h-11 items-center self-start";
const RETRY_STYLES = `inline-flex min-h-[54px] max-w-full items-center justify-center gap-2 rounded-pill bg-brand-red px-7 py-2 text-center text-[17px] leading-tight font-bold text-brand-night no-underline hovered:bg-brand-lime pressed:bg-brand-mist ${TRANSITION_STYLES}`;

type ErrorKind = "notFound" | "server" | "other";

function classifyError(error: unknown): ErrorKind {
  // Una respuesta de ruta (400, 403, 404...) es una decisión de la app y
  // conserva su estado. Todo lo demás es un fallo no controlado.
  if (!isRouteErrorResponse(error)) return "server";
  if (error.status === NOT_FOUND_STATUS) return "notFound";
  return "other";
}

/**
 * Un error no controlado: algo que no es una respuesta de ruta. Una respuesta
 * controlada, también un 503, conserva su estado y usa la página genérica.
 * La página del error no controlado no lleva la cáscara del sitio: se pinta
 * aunque el fallo haya sido justo en leer los ajustes.
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
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  return (
    <div className={CENTERED_STYLES}>
      <title>{title}</title>
      <NoIndex />
      {status === undefined ? null : (
        <p
          aria-hidden="true"
          data-code={status}
          className={SOLID_CODE_STYLES}
        />
      )}
      <h1 className={TITLE_STYLES}>{title}</h1>
      <p className={`${DETAILS_STYLES} text-ink-muted`}>{details}</p>
      {isNotFound ? (
        <nav className={ACTIONS_STYLES}>
          <LocalizedLink page="home" className={HOME_LINK_STYLES}>
            {messages["error.homeShort"]}
          </LocalizedLink>
          {children}
        </nav>
      ) : (
        <div className={ACTIONS_STYLES}>
          <Button to="home">{messages["error.homeLink"]}</Button>
        </div>
      )}
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
    <main className={`${PAGE_STYLES} flex min-h-screen flex-col pt-5 pb-12`}>
      <title>{messages["error.serverTitle"]}</title>
      <NoIndex />
      <a
        href={getPagePath("home", language)}
        aria-label={messages["error.homeLinkLabel"]}
        className={LOGO_LINK_STYLES}
      >
        <img
          src="/brand/wordmark.png"
          alt=""
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          className="h-[30px] w-auto"
        />
      </a>
      <div className="my-auto py-12">
        <p
          aria-hidden="true"
          data-code={SERVER_ERROR_STATUS}
          className={OUTLINED_CODE_STYLES}
        />
        <h1 className={TITLE_STYLES}>{messages["error.serverTitle"]}</h1>
        <p className={`${DETAILS_STYLES} text-ink-muted`}>
          {messages["error.serverDetails"]}
        </p>
        <div className={ACTIONS_STYLES}>
          <a href={`${pathname}${search}`} className={RETRY_STYLES}>
            {messages["error.serverRetry"]}
          </a>
          <Button to="home" variant="secondary">
            {messages["error.homeLink"]}
          </Button>
        </div>
        {/* El navegador no conoce el código, pero la estructura tiene que ser
            la misma que pintó el servidor: el texto del código se deja como
            vino. Una navegación sin recargar que falla vuelve a cargar el
            documento (`sendFailedNavigationToDocument`) y trae su código.
            Queda sin código un envío que falla sin recargar: ahí el párrafo
            se oculta. */}
        <p className="mt-8 text-[14px] text-ink-muted has-[strong:empty]:hidden">
          {messages["error.serverReference"]}:{" "}
          <strong suppressHydrationWarning>{referenceCode ?? ""}</strong>
        </p>
      </div>
    </main>
  );
}
