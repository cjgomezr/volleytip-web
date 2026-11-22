import { describe, expect, it } from "vitest";

import { buildPageAddresses } from "~/lib/i18n/language-alternates";
import { SUPPORTED_LANGUAGES } from "~/lib/i18n/languages";

import { LanguageAlternates } from "./language-alternates";
import { renderInRouter } from "./render-in-router";

const ORIGIN = "https://sitio.volleytip.test";

function renderAt(path: string): string {
  return renderInRouter(<LanguageAlternates siteOrigin={ORIGIN} />, path);
}

function hrefOf(html: string, hreflang: string): string | undefined {
  const pattern = new RegExp(
    `<link rel="alternate" hrefLang="${hreflang}" href="([^"]*)"/>`,
  );
  return pattern.exec(html)?.[1];
}

function canonicalOf(html: string): string | undefined {
  return /<link rel="canonical" href="([^"]*)"\/>/.exec(html)?.[1];
}

describe("versiones por idioma", () => {
  it("lleva un hreflang por cada idioma soportado y uno x-default", () => {
    const { alternates } = buildPageAddresses({
      siteOrigin: ORIGIN,
      language: "es",
      page: "home",
    });

    expect(alternates.map(({ hreflang }) => hreflang)).toEqual([
      ...SUPPORTED_LANGUAGES.map(({ code }) => code),
      "x-default",
    ]);
  });

  it("cada hreflang apunta a la página en su idioma y x-default al español", () => {
    const html = renderAt("/en/");

    expect(hrefOf(html, "es")).toBe(`${ORIGIN}/`);
    expect(hrefOf(html, "en")).toBe(`${ORIGIN}/en/`);
    expect(hrefOf(html, "x-default")).toBe(`${ORIGIN}/`);
  });

  it("la canónica es la dirección de la página en su propio idioma", () => {
    expect(canonicalOf(renderAt("/"))).toBe(`${ORIGIN}/`);
    expect(canonicalOf(renderAt("/en/"))).toBe(`${ORIGIN}/en/`);
  });

  it("/en y /en/ declaran la misma canónica", () => {
    expect(canonicalOf(renderAt("/en"))).toBe(`${ORIGIN}/en/`);
  });

  it("ni la canónica ni los hreflang llevan los parámetros de búsqueda", () => {
    const html = renderAt("/en/?utm_source=x&page=2");

    expect(html).not.toContain("utm_source");
    expect(html).not.toContain("?");
    expect(canonicalOf(html)).toBe(`${ORIGIN}/en/`);
  });

  it("todas las direcciones son absolutas y empiezan por el dominio del entorno", () => {
    const hrefs = [...renderAt("/en/").matchAll(/href="([^"]*)"/g)].map(
      ([, href]) => href,
    );

    expect(hrefs).toHaveLength(SUPPORTED_LANGUAGES.length + 2);
    for (const href of hrefs) {
      expect(href).toMatch(new RegExp(`^${ORIGIN}/`));
    }
  });

  it.each(["/no-existe", "/en/no-existe", "/dev/componentes", "/healthz"])(
    "en %s, que no es una página del sitio, no pinta nada",
    (path) => {
      expect(renderAt(path)).toBe("");
    },
  );
});
