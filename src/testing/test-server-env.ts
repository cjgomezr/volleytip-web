import type { ServerEnv } from "~/lib/env.server";

// Entorno de servidor para pruebas que arman el suyo a mano. Ningún valor
// abre nada: son marcadores, salvo las llaves de Turnstile, que son las de
// prueba que publica Cloudflare.
const TEST_SERVER_ENV: ServerEnv = {
  appEnv: "test",
  supabaseUrl: "https://proyecto-de-prueba.supabase.test",
  supabaseAnonKey: "llave-publica-falsa",
  supabaseServiceRoleKey: "llave-de-servicio-falsa",
  turnstileSiteKey: "1x00000000000000000000AA",
  turnstileSecretKey: "1x0000000000000000000000000000000AA",
  formProtectionSecret:
    "secreto-solo-para-pruebas-no-usar-en-ningun-entorno-real",
  clientIpHeader: "X-Forwarded-For",
  clientIpTrustedHops: 1,
};

/**
 * Devuelve un entorno de servidor completo para una prueba. Cada prueba
 * cambia solo lo que le importa; lo demás queda con valores de mentira.
 */
export function buildTestServerEnv(
  overrides: Partial<ServerEnv> = {},
): ServerEnv {
  return { ...TEST_SERVER_ENV, ...overrides };
}
