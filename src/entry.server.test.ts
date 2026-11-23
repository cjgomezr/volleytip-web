import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleDataRequest } from "./entry.server";
import { reportServerError } from "./lib/server-error-report.server";

afterEach(() => vi.restoreAllMocks());

describe("handleDataRequest", () => {
  it("manda al documento la petición de datos de una navegación que falló", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("http://localhost/dev/fallo.data");
    reportServerError(new Error("falló"), request);

    const response = await handleDataRequest(new Response(null), {
      request,
      params: {},
      context: new RouterContextProvider(),
    });

    expect(response.headers.get("Location")).toBe("/dev/fallo");
  });
});

describe("handleDataRequest con el modo mantenimiento", () => {
  it("pone las cabeceras de mantenimiento a un 503", async () => {
    const request = new Request("http://localhost/tienda.data");

    const response = await handleDataRequest(
      new Response(null, { status: 503 }),
      { request, params: {}, context: new RouterContextProvider() },
    );

    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("no toca las respuestas que no son 503", async () => {
    const request = new Request("http://localhost/tienda.data");

    const response = await handleDataRequest(new Response(null), {
      request,
      params: {},
      context: new RouterContextProvider(),
    });

    expect(response.headers.get("Retry-After")).toBeNull();
  });
});
