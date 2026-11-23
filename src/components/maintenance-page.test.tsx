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

    expect(html).toContain("Volvemos el 1 de diciembre de 2026");
    expect(html).toContain("3:30");
  });

  it("pinta la hora en el formato del inglés", () => {
    const html = renderInRouter(
      <MaintenancePage returnsAt={RETURNS_AT} />,
      "/en/",
    );

    expect(html).toContain("We will be back on December 1, 2026");
  });

  it("no pinta la frase de la hora sin hora", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/");

    expect(html).not.toContain("Volvemos el");
  });

  // "p. m." ya termina en punto: la frase no agrega otro.
  it("la frase de la hora no termina en dos puntos seguidos", () => {
    const html = renderInRouter(
      <MaintenancePage returnsAt={RETURNS_AT} />,
      "/",
    );

    expect(html).toMatch(/p\.\s?m\.</);
    expect(html).not.toMatch(/m\.\.</);
  });
});

// docs/mockups/Errores.png, franja "Mantenimiento".
describe("página de mantenimiento según el mockup", () => {
  it("lleva el rótulo 'Volvemos pronto' sobre el título", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/");
    const english = renderInRouter(
      <MaintenancePage returnsAt={null} />,
      "/en/",
    );

    expect(html).toContain("Volvemos pronto");
    expect(html.indexOf("Volvemos pronto")).toBeLessThan(html.indexOf("<h1"));
    expect(english).toContain("Back soon");
  });

  it("parte el título en dos renglones, el segundo en rojo, dentro de un solo h1", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/");
    const title = /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? "";

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(title).toMatch(/<span[^>]*>Estamos<\/span>/);
    expect(title).toMatch(/<span[^>]*text-brand-red[^>]*>calentando<\/span>/);
  });

  it("pinta cada red como un botón con su nombre, Instagram como principal", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/");
    const links = [...html.matchAll(/<a [^>]*>[^<]*<\/a>/g)].map(
      ([link]) => link,
    );

    expect(links).toHaveLength(3);
    expect(links[0]).toMatch(/>Instagram<\/a>/);
    expect(links[0]).toContain("bg-brand-red");
    expect(links[1]).toMatch(/>TikTok<\/a>/);
    expect(links[2]).toMatch(/>YouTube<\/a>/);
    expect(links[1]).not.toContain("bg-brand-red");
  });

  it("va sobre fondo índigo y centrada", () => {
    const html = renderInRouter(<MaintenancePage returnsAt={null} />, "/");
    const main = /<main[^>]*>/.exec(html)?.[0] ?? "";

    expect(main).toContain("bg-brand-indigo");
    expect(main).toContain("text-center");
  });
});
