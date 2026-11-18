/**
 * El entorno de las corridas de prueba (`APP_ENV=test`). Lo usan Vitest
 * (vitest.config.ts) y el servidor que levanta Playwright
 * (playwright.config.ts), para que ninguno dependa del `.env.local` de quien
 * corre las pruebas.
 *
 * La URL es la de la base local de Supabase CLI. Las llaves son marcadores:
 * ninguna prueba habla todavía con la API de Supabase. La que lo necesite
 * toma las llaves reales de la base local con `supabase status`.
 */
export const TEST_ENV = {
  APP_ENV: "test",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "llave-publica-de-prueba",
  SUPABASE_SERVICE_ROLE_KEY: "llave-de-servicio-de-prueba",
} as const;
