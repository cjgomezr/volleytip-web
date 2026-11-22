import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { LocalizedLink } from "./localized-link";
import { renderInRouter } from "./render-in-router";

describe("enlace localizado", () => {
  it("en una página en español apunta a la dirección sin prefijo", () => {
    const html = renderInRouter(<LocalizedLink page="home">x</LocalizedLink>);

    expect(html).toBe('<a href="/" data-discover="true">x</a>');
  });

  it("en una página en inglés apunta a esa página en inglés", () => {
    const html = renderInRouter(
      <LocalizedLink page="home">x</LocalizedLink>,
      "/en/",
    );

    expect(html).toContain('href="/en/"');
  });

  it("conserva el idioma también desde una dirección inexistente en inglés", () => {
    const html = renderInRouter(
      <LocalizedLink page="home">x</LocalizedLink>,
      "/en/no-existe?a=1",
    );

    expect(html).toContain('href="/en/"');
  });

  it("pasa al enlace los demás atributos", () => {
    const html = renderInRouter(
      <LocalizedLink page="home" className="font-bold" aria-label="Inicio">
        x
      </LocalizedLink>,
    );

    expect(html).toContain('class="font-bold"');
    expect(html).toContain('aria-label="Inicio"');
  });

  it("un enlace a una página que no está en el mapa no compila", () => {
    // @ts-expect-error "no-existe" no es una página del mapa.
    const link = <LocalizedLink page="no-existe">x</LocalizedLink>;
    // @ts-expect-error una dirección escrita a mano tampoco es una página.
    const button = <Button to="/tienda">x</Button>;

    expect([link, button]).toHaveLength(2);
  });

  it("un botón con destino también conserva el idioma", () => {
    const html = renderInRouter(<Button to="home">x</Button>, "/en/");

    expect(html).toMatch(/^<a [^>]*href="\/en\/"/);
  });
});
