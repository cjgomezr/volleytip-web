import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ReferenceCodeContext } from "~/lib/error-reference";

import { ErrorContent, isServerError, ServerErrorPage } from "./error-content";

const FORBIDDEN = { status: 403, statusText: "", internal: false, data: null };
const NOT_FOUND = { status: 404, statusText: "", internal: false, data: null };

function render(path: string, element: React.ReactElement): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>,
  );
}

function countOf(html: string, fragment: string): number {
  return html.split(fragment).length - 1;
}

describe("404", () => {
  it("dice 'Balón fuera' y que la página no existe o se movió, en español", () => {
    const html = render("/nada", <ErrorContent error={NOT_FOUND} />);

    expect(html).toContain("Balón fuera");
    expect(html).toContain("no existe o se movió");
  });

  it("sale en inglés bajo /en/", () => {
    const html = render("/en/nada", <ErrorContent error={NOT_FOUND} />);

    expect(html).toContain("Out of bounds");
  });

  it("enlaza a la home del idioma de la página", () => {
    const html = render("/en/nada", <ErrorContent error={NOT_FOUND} />);

    expect(html).toContain('href="/en/"');
  });

  it("pone los enlaces extra que se le pasan", () => {
    const html = render(
      "/nada",
      <ErrorContent error={NOT_FOUND}>
        <a href="/tips">Tips</a>
      </ErrorContent>,
    );

    expect(html).toContain('href="/tips"');
  });

  it("lleva el código 404 como elemento decorativo y el enlace Inicio", () => {
    const html = render("/nada", <ErrorContent error={NOT_FOUND} />);

    expect(html).toContain('data-code="404"');
    expect(html).toContain(">Inicio<");
  });

  it("no se indexa y tiene un solo h1", () => {
    const html = render("/nada", <ErrorContent error={NOT_FOUND} />);

    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(countOf(html, "<h1")).toBe(1);
  });
});

describe("otros estados", () => {
  it("un 403 usa la página genérica y no dice 500", () => {
    const html = render("/", <ErrorContent error={FORBIDDEN} />);

    expect(html).toContain("No pudimos mostrar esta página");
    expect(html).not.toContain("500");
    expect(isServerError(FORBIDDEN)).toBe(false);
  });
});

describe("500", () => {
  it("dice 'Pedimos tiempo' y ofrece reintentar la misma dirección", () => {
    const html = render("/camps?pagina=2", <ServerErrorPage />);

    expect(html).toContain("Pedimos tiempo");
    expect(html).toContain('href="/camps?pagina=2"');
    expect(html).toContain("Reintentar");
  });

  it("lleva el código 500 como elemento decorativo", () => {
    const html = render("/", <ServerErrorPage />);

    expect(html).toContain('data-code="500"');
  });

  it("ofrece ir a la home y lleva el logo con enlace a la home", () => {
    const html = render("/en/camps", <ServerErrorPage />);

    expect(countOf(html, 'href="/en/"')).toBe(2);
    expect(html).toContain("/brand/wordmark.png");
  });

  it("muestra el código con el que el servidor registró el error", () => {
    const html = render(
      "/",
      <ReferenceCodeContext.Provider value={() => "AB12CD34"}>
        <ServerErrorPage />
      </ReferenceCodeContext.Provider>,
    );

    expect(html).toContain("AB12CD34");
  });

  it("no pinta ningún dato técnico: ni mensaje ni traza", () => {
    const html = render("/", <ServerErrorPage />);

    expect(html).not.toContain("detalle-tecnico-secreto");
    expect(html).not.toMatch(/\n\s+at /);
  });

  it("no se indexa, tiene un solo h1 y no necesita el proveedor de textos", () => {
    const html = render("/", <ServerErrorPage />);

    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(countOf(html, "<h1")).toBe(1);
  });

  it("un error no controlado y una respuesta de ruta no lo es", () => {
    expect(isServerError(new Error("x"))).toBe(true);
    expect(isServerError({ ...NOT_FOUND, status: 503 })).toBe(false);
  });
});
