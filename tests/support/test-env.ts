/**
 * El entorno de las corridas de prueba (`APP_ENV=test`). Lo usan Vitest
 * (vitest.config.ts) y el servidor que levanta Playwright
 * (playwright.config.ts), para que ninguno dependa del `.env.local` de quien
 * corre las pruebas.
 *
 * La URL y la llave pública son las de la base local de Supabase CLI: el CLI
 * pone la misma llave pública en toda base local, así que no es un secreto.
 * La llave de servicio es un marcador: ninguna prueba la usa contra la API.
 */
export const TEST_ENV = {
  APP_ENV: "test",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  SUPABASE_SERVICE_ROLE_KEY: "llave-de-servicio-de-prueba",
} as const;
