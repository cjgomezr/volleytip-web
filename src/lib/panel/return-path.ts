import { getDocumentPath } from "../i18n/document-path";
import {
  getRequestLanguage,
  SUPPORTED_LANGUAGES,
  type Language,
} from "../i18n/languages";
import { getPanelPath, isPanelPath } from "../i18n/panel-pages";

/** El parámetro de la pantalla de entrada con la dirección a la que volver. */
export const RETURN_PARAM = "next";

// Solo sirve para que `URL` interprete una dirección relativa y para
// comprobar que no apunta a otro sitio.
const PARSING_ORIGIN = "http://internal.invalid";
// Lo que React Router agrega al pedir datos; no es parte de la dirección.
const ROUTER_PARAM = "_routes";
const TRAILING_SLASHES = /\/+$/;

// Volver a la entrada o a la salida no lleva a ninguna parte.
function isEntryOrExit(pathname: string): boolean {
  // `/admin/Entrar` no es una sección: caería en el comodín del panel.
  const path = pathname.replace(TRAILING_SLASHES, "").toLowerCase();
  return SUPPORTED_LANGUAGES.some(
    ({ code }) =>
      path === getPanelPath("adminSignIn", code) ||
      path === getPanelPath("adminSignOut", code),
  );
}

/**
 * La dirección del panel a la que se vuelve después de entrar. Lo pedido
 * llega de fuera: solo se acepta una ruta de este sitio que, ya normalizada,
 * siga dentro del panel. Cualquier otra cosa lleva al inicio del panel.
 */
export function resolveReturnPath(
  requested: string | null,
  language: Language,
): string {
  const home = getPanelPath("adminHome", language);
  if (requested === null || !requested.startsWith("/")) return home;
  const url = new URL(requested, PARSING_ORIGIN);
  const isAllowed =
    url.origin === PARSING_ORIGIN &&
    isPanelPath(url.pathname) &&
    // Una dirección de datos serviría el flujo de React Router, no la página.
    getDocumentPath(url) === url.pathname &&
    !isEntryOrExit(url.pathname);
  return isAllowed ? `${url.pathname}${url.search}` : home;
}

/**
 * La pantalla de entrada en el idioma de la petición. Si la petición pedía
 * una página, la dirección va con ella para volver. Un envío no se repite,
 * así que no la lleva.
 */
export function buildSignInPath(request: Request): string {
  const signIn = getPanelPath("adminSignIn", getRequestLanguage(request));
  if (request.method !== "GET" && request.method !== "HEAD") return signIn;
  const url = new URL(request.url);
  url.searchParams.delete(ROUTER_PARAM);
  const requested = `${getDocumentPath(url)}${url.search}`;
  return `${signIn}?${new URLSearchParams({ [RETURN_PARAM]: requested }).toString()}`;
}
