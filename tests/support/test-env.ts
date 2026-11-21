/**
 * El entorno de las corridas de prueba (`APP_ENV=test`). Lo usan Vitest
 * (vitest.config.ts) y el servidor que levanta Playwright
 * (playwright.config.ts), para que ninguno dependa del `.env.local` de quien
 * corre las pruebas.
 *
 * La URL y la llave pública son las de la base local de Supabase CLI: el CLI
 * pone la misma llave pública en toda base local, así que no es un secreto.
 * La llave de servicio es un marcador: ninguna prueba la usa contra la API.
 *
 * Las llaves de Turnstile son las de prueba que publica Cloudflare (siempre
 * pasan y sirven en cualquier dominio), así que tampoco son secretos. Con
 * ellas la verificación no llama a la red. El secreto de formularios solo
 * existe en las pruebas.
 */
export const TEST_ENV = {
  APP_ENV: "test",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  SUPABASE_SERVICE_ROLE_KEY: "llave-de-servicio-de-prueba",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  FORM_PROTECTION_SECRET:
    "secreto-solo-para-pruebas-no-usar-en-ningun-entorno-real",
  CLIENT_IP_HEADER: "X-Forwarded-For",
  CLIENT_IP_TRUSTED_HOPS: "1",
  // No existe: ninguna prueba pide una imagen al CDN.
  IMAGE_CDN_HOST: "imagenes-de-prueba.b-cdn.net",
} as const;
