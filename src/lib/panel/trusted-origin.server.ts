import type { AppEnvironment, ServerEnv } from "../env.server";

const READ_ONLY_METHODS: readonly string[] = ["GET", "HEAD", "OPTIONS"];
// En la máquina de quien programa, el sitio se abre en la dirección del
// servidor de desarrollo, que no tiene por qué ser `SITE_ORIGIN`.
const ENVIRONMENTS_SERVED_ANYWHERE: readonly AppEnvironment[] = [
  "local",
  "test",
];

/**
 * Dice si una petición al panel puede cambiar algo: las de solo lectura
 * siempre, y las demás solo si su cabecera `Origin` es la del sitio
 * (`SITE_ORIGIN`). Es más estricto que la comprobación de React Router, que
 * acepta cualquiera de los dominios de `allowedActionOrigins`.
 */
export function isTrustedSubmission(
  request: Request,
  env: Pick<ServerEnv, "appEnv" | "siteOrigin">,
): boolean {
  if (READ_ONLY_METHODS.includes(request.method)) return true;
  const origin = request.headers.get("Origin");
  if (origin === env.siteOrigin) return true;
  return (
    ENVIRONMENTS_SERVED_ANYWHERE.includes(env.appEnv) &&
    origin === new URL(request.url).origin
  );
}
