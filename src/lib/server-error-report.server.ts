import { randomBytes } from "node:crypto";

import { redirectDocument } from "react-router";

import { getDocumentPath } from "./i18n/document-path";

const REFERENCE_CODE_BYTES = 4;

// Un código por petición: si fallan dos loaders de la misma petición, la
// persona ve un solo código y el registro lo repite en cada error.
const codesByRequest = new WeakMap<Request, string>();

function createReferenceCode(): string {
  return randomBytes(REFERENCE_CODE_BYTES).toString("hex").toUpperCase();
}

/** El código que el registro le dio a esta petición, si algún error lo pidió. */
export function findRequestReferenceCode(request: Request): string | undefined {
  return codesByRequest.get(request);
}

/**
 * Registra un error del servidor con el código de referencia de su petición,
 * el mismo que la página 500 le muestra a la persona. Una petición que el
 * cliente abortó no es un fallo nuestro.
 */
export function reportServerError(error: unknown, request: Request): void {
  if (request.signal.aborted) return;
  const code = codesByRequest.get(request) ?? createReferenceCode();
  codesByRequest.set(request, code);
  console.error(`Error del servidor, referencia ${code}`, error);
}

const ROUTES_PARAM = "_routes";
const LEADING_SLASHES = /^\/{2,}/;

// La dirección del documento de una petición de datos: sin el sufijo `.data`
// y sin el parámetro con el que React Router dice qué rutas pide.
function getDocumentLocation(request: Request): string {
  const url = new URL(request.url);
  url.searchParams.delete(ROUTES_PARAM);
  // Una dirección que empieza con `//` sería, como `Location`, otro sitio.
  const path = getDocumentPath(url).replace(LEADING_SLASHES, "/");
  return `${path}${url.search}`;
}

/**
 * Al navegar sin recargar, React Router pide solo los datos, y el error le
 * llega al navegador ya saneado: sin el código de referencia. Si esa petición
 * falló, se le pide al navegador que cargue el documento. Ahí la página 500
 * la pinta el servidor, con su código.
 *
 * Solo las lecturas. Recargar tras un envío fallido perdería lo enviado y
 * podría mostrar la página como si nada hubiera pasado.
 */
export function sendFailedNavigationToDocument(
  response: Response,
  request: Request,
): Response {
  if (request.method !== "GET") return response;
  if (findRequestReferenceCode(request) === undefined) return response;
  return redirectDocument(getDocumentLocation(request));
}
