import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

const NOT_FOUND_STATUS = 404;
const URL_UNDER_TEST = "http://localhost/dev/cabeceras";

/** Llama a la ruta con otro `APP_ENV`, como en un servidor recién arrancado. */
async function requestHeadersIn(
  appEnv: AppEnvironment,
  headers: Record<string, string>,
): Promise<Response> {
  vi.resetModules();
  stubAppEnv(appEnv);
  const route = await import("./dev-headers");
  return route.loader({ request: new Request(URL_UNDER_TEST, { headers }) });
}

async function catchThrown(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  } catch (error) {
    return error;
  }
  throw new Error("Se esperaba que la ruta lanzara un 404");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("cabeceras de diagnóstico", () => {
  it.each(["local", "test", "staging"] as const)(
    "en %s responde 200 en JSON y sin caché",
    async (appEnv) => {
      const response = await requestHeadersIn(appEnv, {});

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );

  it("en production lanza un 404", async () => {
    const thrown = await catchThrown(() => requestHeadersIn("production", {}));

    expect(thrown).toMatchObject({ init: { status: NOT_FOUND_STATUS } });
  });

  it("devuelve las cabeceras que pone un proxy", async () => {
    const response = await requestHeadersIn("staging", {
      "X-Forwarded-For": "203.0.113.7",
      "X-Forwarded-Proto": "https",
      "X-Real-IP": "203.0.113.7",
      "X-Railway-Request-Id": "abc",
      "X-Envoy-External-Address": "203.0.113.7",
      "CF-Connecting-IP": "203.0.113.7",
      Forwarded: "for=203.0.113.7",
      "True-Client-IP": "203.0.113.7",
      "X-Request-Start": "1700000000",
    });

    expect(await response.json()).toEqual({
      headers: {
        "cf-connecting-ip": "203.0.113.7",
        forwarded: "for=203.0.113.7",
        "true-client-ip": "203.0.113.7",
        "x-envoy-external-address": "203.0.113.7",
        "x-forwarded-for": "203.0.113.7",
        "x-forwarded-proto": "https",
        "x-railway-request-id": "abc",
        "x-real-ip": "203.0.113.7",
        "x-request-start": "1700000000",
      },
    });
  });

  it("no devuelve cookies, autorización ni cabeceras del navegador", async () => {
    const response = await requestHeadersIn("staging", {
      Cookie: "sesion=centinela-cookie",
      Authorization: "Bearer centinela-token",
      "User-Agent": "centinela-navegador",
      Accept: "text/html",
      "X-Api-Key": "centinela-llave",
      // Una credencial que Cloudflare Access pondría con prefijo `cf-`.
      "CF-Access-Jwt-Assertion": "centinela-credencial",
      "X-Forwarded-For": "203.0.113.7",
    });
    const text = await response.text();

    expect(text).not.toContain("centinela");
    expect(JSON.parse(text)).toEqual({
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
  });

  it("sin cabeceras de proxy devuelve una lista vacía", async () => {
    const response = await requestHeadersIn("staging", { Accept: "*/*" });

    expect(await response.json()).toEqual({ headers: {} });
  });
});
