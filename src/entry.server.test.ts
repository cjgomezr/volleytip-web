import type { IncomingMessage, ServerResponse } from "node:http";

import morgan from "morgan";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleDataRequest } from "./entry.server";
import { reportServerError } from "./lib/server-error-report.server";

afterEach(() => vi.restoreAllMocks());

describe("log de acceso", () => {
  // `react-router-serve` registra cada petición con `morgan("tiny")`, que usa
  // este mismo `:url`.
  it("cargar el servidor deja el token fuera de la dirección registrada", () => {
    const request = {
      url: "/admin/entrar/enlace?token_hash=abc123&next=x",
    } as IncomingMessage;
    const format = morgan.compile(":url");

    const tokens = morgan as unknown as Parameters<typeof format>[0];

    const line = format(tokens, request, {} as ServerResponse);

    expect(line).toBe("/admin/entrar/enlace?token_hash=[oculto]&next=x");
  });

  // Una dirección alterada puede acabar dentro del `next` de la entrada.
  it("también lo oculta codificado dentro de otro parámetro", () => {
    const request = {
      url: "/admin/entrar?next=%2Fadmin%2Fx%3Ftoken_hash%3Dabc123%26a%3Db",
    } as IncomingMessage;
    const format = morgan.compile(":url");
    const tokens = morgan as unknown as Parameters<typeof format>[0];

    const line = format(tokens, request, {} as ServerResponse);

    expect(line).toBe(
      "/admin/entrar?next=%2Fadmin%2Fx%3Ftoken_hash%3D[oculto]%26a%3Db",
    );
  });
});

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

  // El panel responde con el modo encendido: su 503 es de otra cosa.
  it.each(["/admin/entrar.data", "/en/admin/sign-in/link.data"])(
    "no toca el 503 de %s",
    async (path) => {
      const request = new Request(`http://localhost${path}`);

      const response = await handleDataRequest(
        new Response(null, { status: 503 }),
        { request, params: {}, context: new RouterContextProvider() },
      );

      expect(response.headers.get("Retry-After")).toBeNull();
    },
  );

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
