import { TEST_ENV } from "../../tests/support/test-env";

import type { LocalSupabaseStatus } from "./local-supabase-status";

type PlaywrightEnv = Readonly<Record<keyof typeof TEST_ENV, string>>;

/**
 * El entorno del servidor que levanta Playwright: el de las pruebas, pero
 * conectado de verdad a la base local. Las páginas leen de la base (la barra
 * de anuncios, las cifras, las preguntas), y una captura sin esos datos no
 * comprueba nada. La llave de servicio sale de Supabase CLI en el momento,
 * no del repo.
 */
export function buildPlaywrightEnv(status: LocalSupabaseStatus): PlaywrightEnv {
  return {
    ...TEST_ENV,
    SUPABASE_URL: status.API_URL,
    SUPABASE_ANON_KEY: status.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY,
  };
}
