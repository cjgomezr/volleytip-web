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
  // No existe: Playwright responde sus imágenes desde el disco
  // (tests/support/test.ts) y las demás pruebas no piden ninguna.
  IMAGE_CDN_HOST: "imagenes-de-prueba.b-cdn.net",
  // A propósito distinto de la dirección donde corren las pruebas: las
  // direcciones absolutas tienen que salir de aquí y no de la petición.
  SITE_ORIGIN: "https://sitio-de-prueba.volleytip.test",
  // Es opcional, pero se fija para que el `.env.local` de nadie la encienda.
  // El botón se prueba en la muestra `/dev/entrar?estado=google`.
  GOOGLE_SIGN_IN_ENABLED: "false",
  // Con APP_ENV=test el servidor usa el Bunny Stream simulado
  // (`openBunnyStream`), así que ninguno de los tres sale a la red.
  BUNNY_STREAM_LIBRARY_ID: "100000",
  BUNNY_STREAM_API_KEY: "llave-de-bunny-stream-de-prueba",
  BUNNY_STREAM_CDN_HOST: "videos-de-prueba.b-cdn.net",
} as const;
