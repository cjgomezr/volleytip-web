import { describe, expect, it } from "vitest";

import {
  APP_ENVIRONMENTS,
  parseServerEnv,
  SERVER_ENV_VARIABLES,
  type EnvSource,
} from "./env.server";

const SECRET_SENTINEL = "valor-secreto-que-no-debe-salir-en-ningun-mensaje";

const FORM_SECRET = "secreto-de-formularios-de-al-menos-32-caracteres";
const MIN_FORM_SECRET_LENGTH = 32;
// Las llaves de prueba que publica Cloudflare. Sirven en cualquier dominio.
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const VALID_SOURCE: EnvSource = {
  APP_ENV: "staging",
  SUPABASE_URL: "https://ejemplo.supabase.test",
  SUPABASE_ANON_KEY: "llave-publica",
  SUPABASE_SERVICE_ROLE_KEY: SECRET_SENTINEL,
  TURNSTILE_SITE_KEY: "0x4AAAAAAA-llave-de-sitio",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAA-llave-secreta",
  FORM_PROTECTION_SECRET: FORM_SECRET,
  CLIENT_IP_HEADER: "X-Forwarded-For",
  CLIENT_IP_TRUSTED_HOPS: "1",
  IMAGE_CDN_HOST: "imagenes-de-prueba.b-cdn.net",
  SITE_ORIGIN: "https://staging.volleytip.test",
};

function withOverrides(overrides: EnvSource): EnvSource {
  return { ...VALID_SOURCE, ...overrides };
}

function expectFailure(source: EnvSource): string {
  const result = parseServerEnv(source);
  if (result.ok) {
    throw new Error("Se esperaba un entorno inválido");
  }
  return result.message;
}

describe("env del servidor", () => {
  it("devuelve el entorno tipado cuando todas las variables están presentes", () => {
    const result = parseServerEnv(VALID_SOURCE);

    expect(result).toEqual({
      ok: true,
      env: {
        appEnv: "staging",
        supabaseUrl: "https://ejemplo.supabase.test",
        supabaseAnonKey: "llave-publica",
        supabaseServiceRoleKey: SECRET_SENTINEL,
        turnstileSiteKey: "0x4AAAAAAA-llave-de-sitio",
        turnstileSecretKey: "0x4AAAAAAA-llave-secreta",
        formProtectionSecret: FORM_SECRET,
        clientIpHeader: "X-Forwarded-For",
        clientIpTrustedHops: 1,
        imageCdnHost: "imagenes-de-prueba.b-cdn.net",
        siteOrigin: "https://staging.volleytip.test",
        googleSignInEnabled: false,
      },
    });
  });

  it.each(APP_ENVIRONMENTS)("acepta APP_ENV=%s", (appEnv) => {
    expect(parseServerEnv(withOverrides({ APP_ENV: appEnv })).ok).toBe(true);
  });

  it("ignora las variables que no le pertenecen", () => {
    const result = parseServerEnv(withOverrides({ PATH: "/usr/bin" }));

    expect(result.ok).toBe(true);
  });

  it.each(SERVER_ENV_VARIABLES)("nombra %s cuando falta", (name) => {
    const message = expectFailure(withOverrides({ [name]: undefined }));

    expect(message).toContain(name);
  });

  it("nombra todas las variables que faltan, no solo la primera", () => {
    const message = expectFailure({});

    for (const name of SERVER_ENV_VARIABLES) {
      expect(message).toContain(name);
    }
  });

  it.each(["", "   "])(
    "cuenta como faltante una variable definida como %j",
    (emptyValue) => {
      const message = expectFailure(
        withOverrides({ SUPABASE_ANON_KEY: emptyValue }),
      );

      expect(message).toContain("SUPABASE_ANON_KEY");
      expect(message).toMatch(/falta/i);
    },
  );

  it("lista los cuatro valores válidos cuando APP_ENV no es ninguno de ellos", () => {
    const message = expectFailure(withOverrides({ APP_ENV: "produccion" }));

    expect(message).toContain("APP_ENV");
    for (const appEnv of APP_ENVIRONMENTS) {
      expect(message).toContain(appEnv);
    }
  });

  it("rechaza un SUPABASE_URL que no es una URL http", () => {
    const message = expectFailure(
      withOverrides({ SUPABASE_URL: "no-es-una-url" }),
    );

    expect(message).toContain("SUPABASE_URL");
  });

  it("junta en un solo mensaje lo que falta y lo que es inválido", () => {
    const message = expectFailure(
      withOverrides({ APP_ENV: "otro", SUPABASE_ANON_KEY: undefined }),
    );

    expect(message).toContain("APP_ENV");
    expect(message).toContain("SUPABASE_ANON_KEY");
  });

  it.each([
    ["falta otra variable", { SUPABASE_URL: undefined }],
    ["APP_ENV es inválido", { APP_ENV: SECRET_SENTINEL }],
    ["SUPABASE_URL es inválida", { SUPABASE_URL: SECRET_SENTINEL }],
    [
      "CLIENT_IP_HEADER es inválida",
      { CLIENT_IP_HEADER: SECRET_SENTINEL + " x" },
    ],
    [
      "CLIENT_IP_TRUSTED_HOPS es inválida",
      { CLIENT_IP_TRUSTED_HOPS: SECRET_SENTINEL },
    ],
    [
      "IMAGE_CDN_HOST es inválida",
      { IMAGE_CDN_HOST: "https://" + SECRET_SENTINEL },
    ],
  ])(
    "no imprime el valor de ninguna variable cuando %s",
    (_case, overrides) => {
      const message = expectFailure(withOverrides(overrides));

      expect(message).not.toContain(SECRET_SENTINEL);
      expect(message).not.toContain("llave-publica");
      expect(message).not.toContain("ejemplo.supabase.test");
    },
  );
});

describe("env del servidor: protección de formularios", () => {
  it("rechaza un FORM_PROTECTION_SECRET corto, sin imprimirlo", () => {
    const shortSecret = "x".repeat(MIN_FORM_SECRET_LENGTH - 1);

    const message = expectFailure(
      withOverrides({ FORM_PROTECTION_SECRET: shortSecret }),
    );

    expect(message).toContain("FORM_PROTECTION_SECRET");
    expect(message).toContain(String(MIN_FORM_SECRET_LENGTH));
    expect(message).not.toContain(shortSecret);
  });

  it("acepta un FORM_PROTECTION_SECRET del largo mínimo", () => {
    const result = parseServerEnv(
      withOverrides({
        FORM_PROTECTION_SECRET: "x".repeat(MIN_FORM_SECRET_LENGTH),
      }),
    );

    expect(result.ok).toBe(true);
  });

  it.each(["0", "-1", "1.5", "uno", "1e3", " "])(
    "rechaza CLIENT_IP_TRUSTED_HOPS=%j",
    (hops) => {
      const message = expectFailure(
        withOverrides({ CLIENT_IP_TRUSTED_HOPS: hops }),
      );

      expect(message).toContain("CLIENT_IP_TRUSTED_HOPS");
    },
  );

  it("acepta CLIENT_IP_TRUSTED_HOPS de dos cifras", () => {
    const result = parseServerEnv(
      withOverrides({ CLIENT_IP_TRUSTED_HOPS: "10" }),
    );

    expect(result).toMatchObject({
      ok: true,
      env: { clientIpTrustedHops: 10 },
    });
  });

  it("convierte CLIENT_IP_TRUSTED_HOPS a número", () => {
    const result = parseServerEnv(
      withOverrides({ CLIENT_IP_TRUSTED_HOPS: "2" }),
    );

    expect(result).toMatchObject({ ok: true, env: { clientIpTrustedHops: 2 } });
  });

  it.each(["X Forwarded For", "X-Forwarded-For:", "cabecera,otra"])(
    "rechaza CLIENT_IP_HEADER=%j, que no es un nombre de cabecera",
    (header) => {
      const message = expectFailure(
        withOverrides({ CLIENT_IP_HEADER: header }),
      );

      expect(message).toContain("CLIENT_IP_HEADER");
    },
  );

  it.each(["staging", "production"])(
    "en %s rechaza las llaves de prueba de Turnstile",
    (appEnv) => {
      const message = expectFailure(
        withOverrides({
          APP_ENV: appEnv,
          TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
          TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
        }),
      );

      expect(message).toContain("TURNSTILE_SITE_KEY");
      expect(message).toContain("TURNSTILE_SECRET_KEY");
    },
  );

  it("en staging rechaza una sola llave de prueba y nombra esa", () => {
    const message = expectFailure(
      withOverrides({ TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY }),
    );

    expect(message).toContain("TURNSTILE_SECRET_KEY");
    expect(message).not.toContain("TURNSTILE_SITE_KEY");
  });

  it.each(["local", "test"])(
    "en %s acepta las llaves de prueba de Turnstile",
    (appEnv) => {
      const result = parseServerEnv(
        withOverrides({
          APP_ENV: appEnv,
          TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
          TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
        }),
      );

      expect(result.ok).toBe(true);
    },
  );
});

describe("dominio del CDN", () => {
  it("sale del módulo de entorno", () => {
    const result = parseServerEnv(
      withOverrides({ IMAGE_CDN_HOST: "volleytip.b-cdn.net" }),
    );

    expect(result).toMatchObject({
      ok: true,
      env: { imageCdnHost: "volleytip.b-cdn.net" },
    });
  });

  it("si falta, el entorno es inválido y nombra la variable", () => {
    const message = expectFailure(withOverrides({ IMAGE_CDN_HOST: undefined }));

    expect(message).toContain("Falta IMAGE_CDN_HOST");
  });

  it.each([
    "https://volleytip.b-cdn.net",
    "volleytip.b-cdn.net/",
    "volleytip.b-cdn.net/fotos",
    "volleytip.b-cdn.net:443",
    "sin-punto",
  ])("rechaza IMAGE_CDN_HOST=%j: va sin protocolo ni ruta", (host) => {
    const message = expectFailure(withOverrides({ IMAGE_CDN_HOST: host }));

    expect(message).toContain("IMAGE_CDN_HOST");
    expect(message).not.toContain(host);
  });
});

describe("env: SITE_ORIGIN", () => {
  it("sale del módulo de entorno", () => {
    const result = parseServerEnv(
      withOverrides({ SITE_ORIGIN: "https://volleytip.com" }),
    );

    expect(result).toMatchObject({
      ok: true,
      env: { siteOrigin: "https://volleytip.com" },
    });
  });

  it("si falta, el entorno es inválido y nombra la variable", () => {
    const message = expectFailure(withOverrides({ SITE_ORIGIN: undefined }));

    expect(message).toContain("Falta SITE_ORIGIN");
  });

  it.each([
    ["con barra final", "https://volleytip.com/"],
    ["con ruta", "https://volleytip.com/en"],
    ["con parámetros de búsqueda", "https://volleytip.com?a=1"],
    ["con ancla", "https://volleytip.com#inicio"],
    ["con usuario", "https://ana@volleytip.com"],
    ["sin protocolo", "dominio-sin-protocolo.test"],
    ["con otro protocolo", "ftp://volleytip.com"],
    ["con el puerto por defecto escrito", "https://volleytip.com:443"],
    ["con mayúsculas en el dominio", "https://VolleyTip.com"],
    ["que no es una dirección", "esto no es una dirección"],
  ])("rechaza un valor %s sin imprimirlo", (_case, origin) => {
    const message = expectFailure(withOverrides({ SITE_ORIGIN: origin }));

    expect(message).toContain("SITE_ORIGIN");
    expect(message).not.toContain(origin);
  });

  it.each(["staging", "production"])(
    "rechaza http en %s sin imprimir el valor",
    (appEnv) => {
      const origin = "http://sitio-sin-cifrar.test";
      const message = expectFailure(
        withOverrides({ APP_ENV: appEnv, SITE_ORIGIN: origin }),
      );

      expect(message).toContain("SITE_ORIGIN");
      expect(message).toContain("https");
      expect(message).not.toContain(origin);
    },
  );

  it.each(["local", "test"])("acepta http en %s", (appEnv) => {
    const result = parseServerEnv(
      withOverrides({
        APP_ENV: appEnv,
        TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
        TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
        SITE_ORIGIN: "http://localhost:3740",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      env: { siteOrigin: "http://localhost:3740" },
    });
  });
});

describe("google: configuración", () => {
  function readFlag(value: string | undefined): boolean {
    const result = parseServerEnv(
      withOverrides({ GOOGLE_SIGN_IN_ENABLED: value }),
    );
    if (!result.ok) throw new Error(result.message);
    return result.env.googleSignInEnabled;
  }

  it.each([undefined, "", "   ", "false"])(
    "con GOOGLE_SIGN_IN_ENABLED=%j queda apagado y el servidor arranca",
    (value) => {
      expect(readFlag(value)).toBe(false);
    },
  );

  it.each(["true", " true "])("con %j queda encendido", (value) => {
    expect(readFlag(value)).toBe(true);
  });

  it.each(["1", "si", "TRUE"])("con %j nombra la variable y falla", (value) => {
    const message = expectFailure(
      withOverrides({ GOOGLE_SIGN_IN_ENABLED: value }),
    );

    expect(message).toContain("GOOGLE_SIGN_IN_ENABLED");
  });
});
