import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES, type Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { LanguageSwitcher } from "./language-switcher";
import type { Zone } from "./pressable";
import { renderInRouter } from "./render-in-router";

function renderAt(path: string, language: Language, zone?: Zone): string {
  return renderInRouter(
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <LanguageSwitcher zone={zone} />
    </TranslationsProvider>,
    path,
  );
}

function linkOf(html: string, language: Language): string {
  const link = new RegExp(`<a [^>]*hrefLang="${language}"[^>]*>[^<]*</a>`).exec(
    html,
  )?.[0];
  if (link === undefined) {
    throw new Error(`No hay enlace para "${language}".`);
  }
  return link;
}

function renderCompactAt(path: string, language: Language): string {
  return renderInRouter(
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <LanguageSwitcher isCompact />
    </TranslationsProvider>,
    path,
  );
}

describe("selector de idioma compacto", () => {
  it("muestra el código de cada idioma y no el nombre completo", () => {
    const html = renderCompactAt("/", "es");

    expect(html).toContain('<span aria-hidden="true">ES</span>');
    expect(html).toContain('<span aria-hidden="true">EN</span>');
  });

  it("el lector de pantalla sigue oyendo el nombre completo", () => {
    const html = renderCompactAt("/", "es");

    expect(html).toContain('<span class="sr-only">Español</span>');
    expect(html).toContain('<span class="sr-only">English</span>');
  });

  it("conserva los enlaces, el idioma actual y la zona de toque", () => {
    const html = renderCompactAt("/en/", "en");

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/en/"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html.match(/min-h-11/g)).toHaveLength(SUPPORTED_LANGUAGES.length);
  });
});

describe("selector de idioma", () => {
  it("sin la forma compacta no pinta códigos", () => {
    const html = renderAt("/", "es");

    expect(html).not.toContain("sr-only");
    expect(html).toContain(">Español</a>");
  });

  it("pinta un enlace por idioma", () => {
    const html = renderAt("/", "es");

    expect(html.match(/<a /g)).toHaveLength(SUPPORTED_LANGUAGES.length);
  });

  it("cada enlace lleva a la misma página en su idioma", () => {
    const html = renderAt("/en/", "en");

    expect(linkOf(html, "es")).toContain('href="/"');
    expect(linkOf(html, "en")).toContain('href="/en/"');
  });

  it("conserva los parámetros de búsqueda", () => {
    const html = renderAt("/?talla=m&color=rojo", "es");

    expect(linkOf(html, "en")).toContain('href="/en/?talla=m&amp;color=rojo"');
    expect(linkOf(html, "es")).toContain('href="/?talla=m&amp;color=rojo"');
  });

  it("el nombre de cada idioma está en ese idioma, también en una página en inglés", () => {
    for (const path of ["/", "/en/"]) {
      const html = renderAt(path, path === "/" ? "es" : "en");

      expect(linkOf(html, "es")).toContain(">Español</a>");
      expect(linkOf(html, "en")).toContain(">English</a>");
    }
  });

  it("cada enlace declara su idioma con lang y hreflang", () => {
    const html = renderAt("/", "es");

    expect(linkOf(html, "es")).toContain('lang="es"');
    expect(linkOf(html, "en")).toContain('lang="en"');
  });

  it.each([
    ["/", "es", "en"],
    ["/en/", "en", "es"],
  ] as const)(
    "en %s solo el idioma actual lleva aria-current",
    (path, current, other) => {
      const html = renderAt(path, current);

      expect(linkOf(html, current)).toContain('aria-current="true"');
      expect(linkOf(html, other)).not.toContain("aria-current");
    },
  );

  it("es una navegación con nombre en el idioma de la página", () => {
    expect(renderAt("/", "es")).toMatch(/^<nav aria-label="Idioma">/);
    expect(renderAt("/en/", "en")).toMatch(/^<nav aria-label="Language">/);
  });

  it("son enlaces con href: funciona sin JavaScript", () => {
    const html = renderAt("/", "es");

    expect(html).not.toContain("<button");
    expect(html.match(/<a [^>]*href="/g)).toHaveLength(
      SUPPORTED_LANGUAGES.length,
    );
  });

  it("cada enlace mide 44 px o más de alto", () => {
    const html = renderAt("/", "es");

    expect(html.match(/min-h-11/g)).toHaveLength(SUPPORTED_LANGUAGES.length);
  });

  it.each(["/dev/componentes", "/no-existe"])(
    "en %s, que no es una página del sitio, lleva a la home de cada idioma",
    (path) => {
      const html = renderAt(path, "es");

      expect(linkOf(html, "es")).toContain('href="/"');
      expect(linkOf(html, "en")).toContain('href="/en/"');
    },
  );

  it("bajo /en/ en una dirección inexistente, el inglés sigue marcado", () => {
    const html = renderAt("/en/no-existe", "en");

    expect(linkOf(html, "en")).toContain('aria-current="true"');
  });

  it("en zona clara el idioma actual va en noche sobre niebla invertido", () => {
    const html = renderAt("/", "es", "light");

    expect(linkOf(html, "es")).toContain("bg-brand-night");
    expect(linkOf(html, "es")).toContain("text-brand-mist");
  });
});
