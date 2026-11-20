import { data } from "react-router";

import { serverEnv } from "~/lib/env.server";

// Ruta de diagnóstico. Devuelve las cabeceras que el proxy del hosting le
// agrega a la petición, para saber en cuál viene la IP del visitante y
// cuántos proxies hay delante (pregunta abierta 6 del PRD de W1). Con eso se
// llenan `CLIENT_IP_HEADER` y `CLIENT_IP_TRUSTED_HOPS` de cada entorno.
//
// Cada quien ve solo las cabeceras de su propia petición. No registra nada.

const NOT_FOUND_STATUS = 404;

// Solo cabeceras de proxy. Nunca cookies, autorización ni nada del navegador.
const PROXY_HEADER_PREFIXES = [
  "x-forwarded-",
  "x-real-",
  "x-railway-",
  "x-envoy-",
  "x-request-",
] as const;

// De Cloudflare van por nombre exacto y no por el prefijo `cf-`: bajo ese
// prefijo también viajan credenciales (`cf-access-jwt-assertion`).
const PROXY_HEADER_NAMES: readonly string[] = [
  "forwarded",
  "true-client-ip",
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "cf-ray",
  "cf-visitor",
];

function isProxyHeader(name: string): boolean {
  return (
    PROXY_HEADER_NAMES.includes(name) ||
    PROXY_HEADER_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

export function loader({ request }: { request: Request }): Response {
  // No existe en producción, igual que la página de muestra.
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  // `Headers` entrega los nombres en minúsculas.
  const proxyHeaders = Object.fromEntries(
    [...request.headers]
      .filter(([name]) => isProxyHeader(name))
      .sort(([first], [second]) => first.localeCompare(second)),
  );
  return Response.json(
    { headers: proxyHeaders },
    { headers: { "Cache-Control": "no-store" } },
  );
}
