import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ErrorBoundary } from "./root";

type BoundaryProps = ComponentProps<typeof ErrorBoundary>;

const NOT_FOUND = { status: 404, statusText: "", internal: false, data: null };
const SERVER_ERROR = new Error("falló un loader");

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

    expect(html).toContain("Balón fuera");
  });

  it("el 404 se pinta en inglés bajo /en/", () => {
    const html = renderBoundaryAt("/en/no-existe", NOT_FOUND);

    expect(html).toContain("Out of bounds");
  });

  it("el error general se pinta en español", () => {
    const html = renderBoundaryAt("/", SERVER_ERROR);

    expect(html).toContain("Pedimos tiempo");
  });

  it("el error general se pinta en inglés bajo /en/", () => {
    const html = renderBoundaryAt("/en/", SERVER_ERROR);

    expect(html).toContain("Timeout called");
  });

  it("un error que no es una respuesta de ruta también tiene su página", () => {
    const html = renderBoundaryAt("/en/", "algo que no es un Error");

    expect(html).toContain("Timeout called");
  });
});
