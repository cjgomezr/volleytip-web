import { describe, expect, it } from "vitest";

import { MaintenancePage } from "./maintenance-page";
import { renderInRouter } from "./render-in-router";

const RETURNS_AT = "2026-12-01T20:30:00Z";

describe("página de mantenimiento", () => {
  it("muestra el logo, el título y las tres redes, sin header, pie ni barra", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/");

    expect(html).toContain("Estamos calentando");
    expect(html).toContain("/brand/wordmark.png");
    expect(html).toContain("instagram.com/volleytip");
    expect(html).toContain("tiktok.com/@volleytip");
    expect(html).toContain("youtube.com/@volleytip");
    expect(html).not.toContain("<header");
    expect(html).not.toContain("<footer");
    expect(html).not.toContain("facebook.com");
  });

  it("sale en inglés bajo /en/", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/en/");

    expect(html).toContain("We are warming up");
  });

  it("pinta la hora de Colombia en español", () => {
    const html = renderInRouter(
      <MaintenancePage returnsAt={RETURNS_AT} />,
      "/",
    );

    expect(html).toContain("Volvemos hacia las");
    expect(html).toContain("3:30");
    expect(html).toMatch(/1 de diciembre de 2026/);
  });

  it("pinta la hora en el formato del inglés", () => {
    const html = renderInRouter(
      <MaintenancePage returnsAt={RETURNS_AT} />,
      "/en/",
    );

    expect(html).toContain("We will be back around");
    expect(html).toContain("December 1, 2026");
  });

  it("no pinta la frase de la hora sin hora", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/");

    expect(html).not.toContain("Volvemos hacia");
  });
});
