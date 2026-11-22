import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findRequestReferenceCode,
  reportServerError,
  sendFailedNavigationToDocument,
} from "./server-error-report.server";

const REFERENCE_FORMAT = /^[0-9A-F]{8}$/;

function requestWith(signal?: AbortSignal): Request {
  return new Request("http://localhost/algo", { signal });
}

function silenceLog(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

afterEach(() => vi.restoreAllMocks());

describe("reportServerError", () => {
  it("registra el error junto a un código corto ligado a la petición", () => {
    const log = silenceLog();
    const request = requestWith();
    const error = new Error("falló la base");

    reportServerError(error, request);

    const code = findRequestReferenceCode(request);
    expect(code).toMatch(REFERENCE_FORMAT);
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0]?.[0])).toContain(code);
    expect(log.mock.calls[0]).toContain(error);
  });

  it("da el mismo código a dos errores de la misma petición", () => {
    silenceLog();
    const request = requestWith();

    reportServerError(new Error("a"), request);
    const first = findRequestReferenceCode(request);
    reportServerError(new Error("b"), request);

    expect(findRequestReferenceCode(request)).toBe(first);
  });

  it("da un código distinto a cada petición", () => {
    silenceLog();
    const first = requestWith();
    const second = requestWith();

    reportServerError(new Error("a"), first);
    reportServerError(new Error("b"), second);

    expect(findRequestReferenceCode(first)).not.toBe(
      findRequestReferenceCode(second),
    );
  });

  it("no registra una petición que el cliente abortó", () => {
    const log = silenceLog();
    const controller = new AbortController();
    controller.abort();
    const request = requestWith(controller.signal);

    reportServerError(new Error("cortada"), request);

    expect(log).not.toHaveBeenCalled();
    expect(findRequestReferenceCode(request)).toBeUndefined();
  });
});

describe("sendFailedNavigationToDocument", () => {
  const dataResponse = (): Response => new Response("datos", { status: 500 });

  it("manda al navegador a cargar el documento cuando la petición de datos falló", () => {
    silenceLog();
    const request = new Request(
      "http://localhost/en/tips.data?talla=m&_routes=root%2Croutes%2Ftips",
    );
    reportServerError(new Error("falló la base"), request);

    const response = sendFailedNavigationToDocument(dataResponse(), request);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/en/tips?talla=m");
    expect(response.headers.get("X-Remix-Reload-Document")).toBe("true");
  });

  it("deja igual la respuesta de una petición de datos que no falló", () => {
    const request = new Request("http://localhost/en/tips.data");
    const original = dataResponse();

    expect(sendFailedNavigationToDocument(original, request)).toBe(original);
  });

  it("deja igual la respuesta de un envío que falló: recargar perdería lo enviado", () => {
    silenceLog();
    const request = new Request("http://localhost/contacto.data", {
      method: "POST",
    });
    reportServerError(new Error("falló el envío"), request);
    const original = dataResponse();

    expect(sendFailedNavigationToDocument(original, request)).toBe(original);
  });
});
