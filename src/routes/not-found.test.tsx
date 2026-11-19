import { isRouteErrorResponse } from "react-router";
import { describe, expect, it } from "vitest";

import { action, loader } from "./not-found";

const NOT_FOUND_STATUS = 404;

function catchThrown(work: () => unknown): unknown {
  try {
    work();
  } catch (error) {
    return error;
  }
  throw new Error("Se esperaba que la ruta lanzara un 404");
}

function readStatus(thrown: unknown): number | undefined {
  if (isRouteErrorResponse(thrown)) {
    return thrown.status;
  }
  if (typeof thrown === "object" && thrown !== null && "init" in thrown) {
    return (thrown.init as ResponseInit | null)?.status;
  }
  return undefined;
}

describe("ruta comodín", () => {
  it("una dirección que no existe responde 404 al leerla", () => {
    expect(readStatus(catchThrown(loader))).toBe(NOT_FOUND_STATUS);
  });

  it("y también al enviarle un formulario", () => {
    expect(readStatus(catchThrown(action))).toBe(NOT_FOUND_STATUS);
  });
});
