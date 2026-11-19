import type { AppEnvironment } from "./env.server";

const ROBOTS_HEADER = "X-Robots-Tag";
export const NO_INDEX_DIRECTIVES = "noindex, nofollow";

// Solo producción se deja indexar. El entorno de pruebas responde en un
// dominio público y, si un buscador lo indexa, compite con el sitio real.
const INDEXABLE_ENVIRONMENT: AppEnvironment = "production";

/**
 * Devuelve la respuesta con la cabecera que pide a los buscadores no
 * indexarla, salvo en producción. Vale para cualquier respuesta, también las
 * de error.
 */
export function markAsNotIndexable(
  response: Response,
  appEnv: AppEnvironment,
): Response {
  if (appEnv === INDEXABLE_ENVIRONMENT) {
    return response;
  }
  // Se copia en vez de modificar: hay respuestas con cabeceras inmutables
  // (`Response.redirect()`, las que vienen de `fetch`).
  const headers = new Headers(response.headers);
  headers.set(ROBOTS_HEADER, NO_INDEX_DIRECTIVES);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
