/**
 * Llaves de prueba que publica Cloudflare para Turnstile. Son públicas y
 * sirven en cualquier dominio. Fuente, consultada el 20 de noviembre de 2026:
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 *
 * Con una llave secreta de prueba Cloudflare solo acepta el token ficticio,
 * y una llave real lo rechaza. Por eso nunca deben llegar a `staging` ni a
 * `production`: el módulo de entorno lo impide.
 */
export const TURNSTILE_TEST_KEYS = {
  /** Llave de sitio: el widget es visible y siempre pasa. */
  siteKey: "1x00000000000000000000AA",
  /** Llave secreta: la verificación siempre pasa. */
  passingSecretKey: "1x0000000000000000000000000000000AA",
  /** Llave secreta: la verificación siempre falla. */
  failingSecretKey: "2x0000000000000000000000000000000AA",
  /** El token que entrega el widget con una llave de sitio de prueba. */
  dummyToken: "XXXX.DUMMY.TOKEN.XXXX",
} as const;

// Todas las llaves de prueba de la tabla de Cloudflare: cinco de sitio y
// tres secretas.
const TEST_SITE_KEYS: readonly string[] = [
  TURNSTILE_TEST_KEYS.siteKey,
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
];

const TEST_SECRET_KEYS: readonly string[] = [
  TURNSTILE_TEST_KEYS.passingSecretKey,
  TURNSTILE_TEST_KEYS.failingSecretKey,
  "3x0000000000000000000000000000000AA",
];

export function isTurnstileTestSiteKey(siteKey: string): boolean {
  return TEST_SITE_KEYS.includes(siteKey);
}

export function isTurnstileTestSecretKey(secretKey: string): boolean {
  return TEST_SECRET_KEYS.includes(secretKey);
}
