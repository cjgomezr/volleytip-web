import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_ENVIRONMENTS, type AppEnvironment } from "~/lib/env.server";

import { loader } from "./healthz";

const HEALTHZ_SOURCE = fileURLToPath(new URL("./healthz.ts", import.meta.url));
// Lo único del servidor que la ruta puede importar.
const ENV_MODULE = "~/lib/env.server";

/** Carga la ruta de nuevo con otro `APP_ENV`, como en un servidor recién
 * arrancado: el entorno se valida una sola vez, al cargar el módulo. */
async function loadHealthzIn(appEnv: AppEnvironment): Promise<Response> {
  vi.resetModules();
  vi.stubEnv("APP_ENV", appEnv);
  const route = await import("./healthz");
  return route.loader();
}

function listImportedModules(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (match) => match[1] ?? "",
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
  vi.resetModules();
});

describe("healthz", () => {
  it("responde 200 en JSON", () => {
    const response = loader();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("pide no guardarse en caché, para que el monitoreo llegue al servidor", () => {
    const response = loader();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each(APP_ENVIRONMENTS)(
    "con APP_ENV=%s devuelve el estado y ese entorno, sin caché",
    async (appEnv) => {
      const response = await loadHealthzIn(appEnv);

      expect(await response.json()).toEqual({
        status: "ok",
        environment: appEnv,
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );

  it.each(APP_ENVIRONMENTS)(
    "con APP_ENV=%s el cuerpo tiene exactamente dos claves",
    async (appEnv) => {
      const response = await loadHealthzIn(appEnv);
      const body: unknown = await response.json();

      expect(Object.keys(body as object).sort()).toEqual([
        "environment",
        "status",
      ]);
    },
  );

  it("el cuerpo no trae ningún otro valor del entorno", async () => {
    vi.stubEnv("SUPABASE_URL", "https://centinela-url.supabase.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "centinela-llave-publica");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "centinela-llave-de-servicio");

    const response = await loadHealthzIn("staging");

    expect(await response.text()).not.toContain("centinela");
  });

  it("responde aunque el cliente de Supabase no se pueda crear", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: (): never => {
        throw new Error("Supabase no está disponible");
      },
    }));

    const response = await loadHealthzIn("staging");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      environment: "staging",
    });
  });

  it("no importa Supabase ni ningún otro módulo aparte del entorno", () => {
    const source = readFileSync(HEALTHZ_SOURCE, "utf8");

    expect(listImportedModules(source)).toEqual([ENV_MODULE]);
  });

  it("no hace ninguna petición de red", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await loadHealthzIn("staging");

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
