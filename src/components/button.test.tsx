import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { renderInRouter } from "./render-in-router";

describe("Botón", () => {
  it("con destino se pinta como enlace", () => {
    const html = renderInRouter(<Button to="/tienda">Ir a la tienda</Button>);

    expect(html).toMatch(/^<a [^>]*href="\/tienda"/);
    expect(html).toContain("Ir a la tienda");
    expect(html).not.toContain("<button");
  });

  it("sin destino se pinta como button con type button", () => {
    const html = renderInRouter(<Button>Agregar</Button>);

    expect(html).toMatch(/^<button [^>]*type="button"/);
    expect(html).not.toContain("<a ");
  });

  it("usa type submit cuando se pide", () => {
    const html = renderInRouter(<Button type="submit">Enviar</Button>);

    expect(html).toMatch(/^<button [^>]*type="submit"/);
  });

  it("deshabilitado lleva el atributo disabled, que impide el clic", () => {
    const html = renderInRouter(<Button isDisabled>Agregar</Button>);

    expect(html).toMatch(/^<button [^>]*disabled=""/);
  });

  it("un enlace deshabilitado no lleva destino y se anuncia deshabilitado", () => {
    const html = renderInRouter(
      <Button to="/tienda" isDisabled>
        Ir a la tienda
      </Button>,
    );

    expect(html).toMatch(/^<a [^>]*aria-disabled="true"/);
    expect(html).not.toContain("href=");
  });

  it("en envío queda deshabilitado y ocupado", () => {
    const html = renderInRouter(
      <Button type="submit" submittingLabel="Enviando tu mensaje">
        Enviar
      </Button>,
    );

    expect(html).toMatch(/^<button [^>]*aria-disabled="true"/);
    expect(html).toMatch(/^<button [^>]*aria-busy="true"/);
  });

  it("en envío anuncia el estado a lectores de pantalla, fuera del botón", () => {
    const html = renderInRouter(
      <Button type="submit" submittingLabel="Enviando tu mensaje">
        Enviar
      </Button>,
    );

    expect(html).toMatch(
      /<\/button><span [^>]*role="status"[^>]*>Enviando tu mensaje<\/span>$/,
    );
  });

  it("sin envío la zona de anuncio existe vacía, para que el cambio se anuncie", () => {
    const html = renderInRouter(<Button type="submit">Enviar</Button>);

    expect(html).toMatch(/<span [^>]*role="status"[^>]*><\/span>$/);
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("aria-disabled");
  });

  it("un botón que no envía no lleva zona de anuncio", () => {
    const html = renderInRouter(<Button>Agregar</Button>);

    expect(html).not.toContain('role="status"');
  });

  it("en envío conserva su color y muestra un indicador decorativo", () => {
    const html = renderInRouter(
      <Button type="submit" submittingLabel="Enviando tu mensaje">
        Enviar
      </Button>,
    );

    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*animate-spin/);
    expect(html).not.toContain("opacity-50");
    expect(html).not.toContain("hovered:");
  });

  it("no contiene ningún texto propio: solo pinta el que recibe", () => {
    const html = renderInRouter(<Button>Agregar</Button>);
    const visibleText = html.replaceAll(/<[^>]+>/g, "");

    expect(visibleText).toBe("Agregar");
  });

  it.each([
    ["primary", "dark"],
    ["primary", "light"],
    ["secondary", "dark"],
    ["secondary", "light"],
  ] as const)(
    "el %s en zona %s tiene estilos de hover y de activo",
    (variant, zone) => {
      const html = renderInRouter(
        <Button variant={variant} zone={zone}>
          Agregar
        </Button>,
      );

      expect(html).toContain("hovered:");
      expect(html).toContain("pressed:");
      expect(html).toContain("rounded-pill");
    },
  );

  it.each(["primary", "secondary"] as const)(
    "en zona clara el %s cambia el anillo de foco a brand-night",
    (variant) => {
      const light = renderInRouter(
        <Button variant={variant} zone="light">
          Agregar
        </Button>,
      );
      const dark = renderInRouter(<Button variant={variant}>Agregar</Button>);

      expect(light).toContain("focused:outline-brand-night");
      expect(dark).not.toContain("focused:outline-brand-night");
    },
  );

  it("deshabilitado no conserva los estilos de hover ni de activo", () => {
    const html = renderInRouter(<Button isDisabled>Agregar</Button>);

    expect(html).not.toContain("hovered:");
    expect(html).not.toContain("pressed:");
  });
});
