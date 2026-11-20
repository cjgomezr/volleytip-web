import { vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";

// Las pruebas corren con las llaves de prueba de Turnstile, que el módulo de
// entorno rechaza en `staging` y `production`. Estas dos solo tienen forma de
// llave real; no abren nada.
const NON_TEST_TURNSTILE_SITE_KEY = "0x4AAAAAAA-llave-de-sitio-de-mentira";
const NON_TEST_TURNSTILE_SECRET_KEY = "0x4AAAAAAA-llave-secreta-de-mentira";

const ENVIRONMENTS_WITH_REAL_KEYS: readonly AppEnvironment[] = [
  "staging",
  "production",
];

/**
 * Cambia `APP_ENV` para la prueba en curso y deja el resto del entorno
 * válido para ese valor. Se deshace con `vi.unstubAllEnvs()`.
 */
export function stubAppEnv(appEnv: AppEnvironment): void {
  vi.stubEnv("APP_ENV", appEnv);
  if (ENVIRONMENTS_WITH_REAL_KEYS.includes(appEnv)) {
    vi.stubEnv("TURNSTILE_SITE_KEY", NON_TEST_TURNSTILE_SITE_KEY);
    vi.stubEnv("TURNSTILE_SECRET_KEY", NON_TEST_TURNSTILE_SECRET_KEY);
  }
}
