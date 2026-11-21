import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ErrorBoundary } from "./root";

type BoundaryProps = ComponentProps<typeof ErrorBoundary>;

const NOT_FOUND = { status: 404, statusText: "", internal: false, data: null };
const SERVER_ERROR = {
  status: 500,
  statusText: "",
  internal: false,
  data: null,
};

/**
 * Pinta la página de error sin proveedor de traducciones alrededor, que es
 * como queda cuando el fallo ocurre antes de que la raíz tenga sus datos.
 */
function renderBoundaryAt(path: string, error: unknown): string {
  const props = { error, params: {} } as unknown as BoundaryProps;
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ErrorBoundary {...props} />
    </MemoryRouter>,
  );
}

describe("página de error sin datos de la raíz", () => {
  it("el 404 se pinta en español en una dirección sin prefijo", () => {
    const html = renderBoundaryAt("/no-existe", NOT_FOUND);

    expect(html).toContain("Esta página no existe.");
  });

  it("el 404 se pinta en inglés bajo /en/", () => {
    const html = renderBoundaryAt("/en/no-existe", NOT_FOUND);

    expect(html).toContain("This page does not exist.");
  });

  it("el error general se pinta en español", () => {
    const html = renderBoundaryAt("/", SERVER_ERROR);

    expect(html).toContain("Algo salió mal. Intenta de nuevo.");
  });

  it("el error general se pinta en inglés bajo /en/", () => {
    const html = renderBoundaryAt("/en/", SERVER_ERROR);

    expect(html).toContain("Something went wrong. Please try again.");
  });

  it("un error que no es una respuesta de ruta también tiene su página", () => {
    const html = renderBoundaryAt("/en/", "algo que no es un Error");

    expect(html).toContain("Something went wrong. Please try again.");
  });
});
