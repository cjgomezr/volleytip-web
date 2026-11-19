import { describe, expect, it } from "vitest";

import { APP_ENVIRONMENTS, type AppEnvironment } from "./env.server";
import { markAsNotIndexable, NO_INDEX_DIRECTIVES } from "./indexing.server";

const ROBOTS_HEADER = "X-Robots-Tag";
const NON_PRODUCTION: readonly AppEnvironment[] = ["local", "test", "staging"];
const NOT_FOUND_STATUS = 404;
const SERVER_ERROR_STATUS = 500;

function respondWith(status: number): Response {
  return new Response("cuerpo", { status });
}

describe("X-Robots-Tag", () => {
  it("la lista de entornos de la prueba cubre todos los que existen", () => {
    expect([...NON_PRODUCTION, "production"].sort()).toEqual(
      [...APP_ENVIRONMENTS].sort(),
    );
  });

  it.each(NON_PRODUCTION)(
    "en %s la respuesta pide no ser indexada, con el valor exacto",
    (appEnv) => {
      const response = markAsNotIndexable(respondWith(200), appEnv);

      expect(response.headers.get(ROBOTS_HEADER)).toBe("noindex, nofollow");
    },
  );

  it("el valor de la cabecera es el que fija el ticket", () => {
    expect(NO_INDEX_DIRECTIVES).toBe("noindex, nofollow");
  });

  it("en production la respuesta no lleva la cabecera", () => {
    const response = markAsNotIndexable(respondWith(200), "production");

    expect(response.headers.has(ROBOTS_HEADER)).toBe(false);
  });

  it.each([NOT_FOUND_STATUS, SERVER_ERROR_STATUS])(
    "fuera de producción una respuesta %i también la lleva",
    (status) => {
      const response = markAsNotIndexable(respondWith(status), "staging");

      expect(response.status).toBe(status);
      expect(response.headers.get(ROBOTS_HEADER)).toBe("noindex, nofollow");
    },
  );

  it("en production una respuesta de error tampoco la lleva", () => {
    const response = markAsNotIndexable(
      respondWith(NOT_FOUND_STATUS),
      "production",
    );

    expect(response.headers.has(ROBOTS_HEADER)).toBe(false);
  });

  it("no cambia el cuerpo, el estado ni las demás cabeceras", async () => {
    const original = new Response("hola", {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });

    const response = markAsNotIndexable(original, "staging");

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("hola");
  });

  // `Response.redirect()` y las respuestas de `fetch` traen cabeceras que no
  // se pueden modificar.
  it("marca también una respuesta con cabeceras inmutables", () => {
    const redirect = Response.redirect("http://localhost/destino", 302);

    const response = markAsNotIndexable(redirect, "staging");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("http://localhost/destino");
    expect(response.headers.get(ROBOTS_HEADER)).toBe("noindex, nofollow");
  });
});
