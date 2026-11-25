import { describe, expect, it } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { isTrustedSubmission } from "./trusted-origin.server";

const PRODUCTION = buildTestServerEnv({
  appEnv: "production",
  siteOrigin: "https://volleytip.com",
});
const URL_BEHIND_PROXY = "http://volleytip.com/admin/salir";

function submit(origin: string | undefined, url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: origin === undefined ? {} : { Origin: origin },
  });
}

describe("guardia del panel: origen de un envío", () => {
  it("acepta el origen del sitio, aunque el proxy cambie el protocolo", () => {
    const request = submit("https://volleytip.com", URL_BEHIND_PROXY);

    expect(isTrustedSubmission(request, PRODUCTION)).toBe(true);
  });

  it.each([
    ["no viene", undefined],
    ["es null", "null"],
    ["es de otro sitio", "https://sitio-ajeno.test"],
    ["es un subdominio", "https://otro.volleytip.com"],
    ["usa otro protocolo", "http://volleytip.com"],
  ])("rechaza el envío si el origen %s", (_name, origin) => {
    const request = submit(origin, URL_BEHIND_PROXY);

    expect(isTrustedSubmission(request, PRODUCTION)).toBe(false);
  });

  it.each(["local", "test"] as const)(
    "en %s acepta además la dirección donde se sirve",
    (appEnv) => {
      const env = buildTestServerEnv({ appEnv });
      const request = submit(
        "http://localhost:3740",
        "http://localhost:3740/admin/salir",
      );

      expect(isTrustedSubmission(request, env)).toBe(true);
    },
  );

  it("fuera de local no basta con que coincida con la petición", () => {
    const request = submit(
      "http://volleytip.com",
      "http://volleytip.com/admin/salir",
    );

    expect(isTrustedSubmission(request, PRODUCTION)).toBe(false);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("no le pide origen a un %s", (method) => {
    const request = new Request(URL_BEHIND_PROXY, { method });

    expect(isTrustedSubmission(request, PRODUCTION)).toBe(true);
  });

  it.each(["PUT", "PATCH", "DELETE"])("sí se lo pide a un %s", (method) => {
    const request = new Request(URL_BEHIND_PROXY, { method });

    expect(isTrustedSubmission(request, PRODUCTION)).toBe(false);
  });
});
