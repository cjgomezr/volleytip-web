import { describe, expect, it } from "vitest";

import { IconButton } from "./icon-button";
import { renderInRouter } from "./render-in-router";

const ICON = <svg aria-hidden="true" width="20" height="20" />;

describe("Botón de ícono", () => {
  it("expone su aria-label", () => {
    const html = renderInRouter(
      <IconButton aria-label="Cerrar el menú">{ICON}</IconButton>,
    );

    expect(html).toMatch(/^<button [^>]*aria-label="Cerrar el menú"/);
    expect(html).toMatch(/^<button [^>]*type="button"/);
  });

  it("con destino es un enlace con su aria-label", () => {
    const html = renderInRouter(
      <IconButton to="home" aria-label="Ir al inicio">
        {ICON}
      </IconButton>,
    );

    expect(html).toMatch(/^<a [^>]*href="\/"/);
    expect(html).toMatch(/^<a [^>]*aria-label="Ir al inicio"/);
  });

  it("mide 44 por 44 px, es un círculo con borde y no se encoge", () => {
    const html = renderInRouter(
      <IconButton aria-label="Cerrar el menú">{ICON}</IconButton>,
    );

    expect(html).toContain("size-11");
    expect(html).toContain("rounded-pill");
    expect(html).toContain("shrink-0");
    expect(html).toContain("border-2");
  });

  it("sin aria-label no compila", () => {
    // @ts-expect-error -- el tipo exige aria-label: un botón de solo ícono no tiene otro nombre
    const withoutLabel = <IconButton>{ICON}</IconButton>;

    expect(withoutLabel).toBeDefined();
  });

  it("deshabilitado lleva el atributo disabled", () => {
    const html = renderInRouter(
      <IconButton aria-label="Cerrar el menú" isDisabled>
        {ICON}
      </IconButton>,
    );

    expect(html).toMatch(/^<button [^>]*disabled=""/);
  });
});
