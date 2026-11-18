import { describe, expect, it } from "vitest";

import {
  APP_ENVIRONMENTS,
  parseServerEnv,
  SERVER_ENV_VARIABLES,
  type EnvSource,
} from "./env.server";

const SECRET_SENTINEL = "valor-secreto-que-no-debe-salir-en-ningun-mensaje";

const VALID_SOURCE: EnvSource = {
  APP_ENV: "staging",
  SUPABASE_URL: "https://ejemplo.supabase.test",
  SUPABASE_ANON_KEY: "llave-publica",
  SUPABASE_SERVICE_ROLE_KEY: SECRET_SENTINEL,
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
