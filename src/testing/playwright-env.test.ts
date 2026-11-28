import { describe, expect, it } from "vitest";

import { TEST_ENV } from "../../tests/support/test-env";

import { buildPlaywrightEnv } from "./playwright-env";

const LOCAL_STATUS = {
  API_URL: "http://127.0.0.1:54321",
  PUBLISHABLE_KEY: "llave-publica-local",
  SECRET_KEY: "llave-de-servicio-local",
};

describe("entorno de Playwright", () => {
  it("usa la URL y las llaves de la base local que está arriba", () => {
    const env = buildPlaywrightEnv(LOCAL_STATUS);

    expect(env.SUPABASE_URL).toBe(LOCAL_STATUS.API_URL);
    expect(env.SUPABASE_ANON_KEY).toBe(LOCAL_STATUS.PUBLISHABLE_KEY);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(LOCAL_STATUS.SECRET_KEY);
  });

  it("no usa la llave de servicio de marcador de las pruebas unitarias", () => {
    const env = buildPlaywrightEnv(LOCAL_STATUS);

    expect(env.SUPABASE_SERVICE_ROLE_KEY).not.toBe(
      TEST_ENV.SUPABASE_SERVICE_ROLE_KEY,
    );
  });

  // Sin un valor aquí, el servidor de desarrollo lo tomaría del `.env.local`
  // de quien corre las pruebas.
  it("fija Google apagado, diga lo que diga el entorno local", () => {
    const env = buildPlaywrightEnv(LOCAL_STATUS);

    expect(env.GOOGLE_SIGN_IN_ENABLED).toBe("false");
  });

  it("conserva el resto del entorno de pruebas", () => {
    const env = buildPlaywrightEnv(LOCAL_STATUS);

    expect(env.APP_ENV).toBe("test");
    expect(env.SITE_ORIGIN).toBe(TEST_ENV.SITE_ORIGIN);
    expect(env.TURNSTILE_SECRET_KEY).toBe(TEST_ENV.TURNSTILE_SECRET_KEY);
  });
});
