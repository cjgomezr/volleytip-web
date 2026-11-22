import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import type { PageDeclaration } from "~/lib/i18n/page-path";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { SiteFooter } from "./site-footer";

const HOME: PageDeclaration = { id: "home", file: "routes/home.tsx", path: "" };
const SHOP: PageDeclaration = {
  id: "shop",
  file: "routes/shop.tsx",
  path: { es: "tienda", en: "shop" },
};

function renderFooter({
  at = "/",
  pages = [HOME],
  year = 2026,
}: {
  at?: string;
  pages?: readonly PageDeclaration[];
  year?: number;
} = {}): string {
  const language: Language = at.startsWith("/en") ? "en" : "es";
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[at]}>
      <TranslationsProvider
        language={language}
        messages={getMessages(language)}
      >
        <SiteFooter pages={pages} year={year} />
      </TranslationsProvider>
    </MemoryRouter>,
  );
}

function anchorsOf(html: string): string[] {
  return html.match(/<a [^>]*>/g) ?? [];
}

describe("pie: redes", () => {
  it("shows five network links with an accessible name", () => {
    const html = renderFooter();

    for (const name of [
      "TikTok",
      "Instagram",
      "YouTube",
      "Facebook",
      "WhatsApp",
    ]) {
      expect(html).toMatch(new RegExp(`aria-label="${name}"`));
    }
  });

  it("links WhatsApp to the number of FR-003", () => {
    expect(renderFooter()).toContain('href="https://wa.me/573146486275"');
  });

  it("opens every network in another tab with rel noopener noreferrer", () => {
    const external = anchorsOf(renderFooter()).filter((tag) =>
      tag.includes('href="https://'),
    );

    expect(external).toHaveLength(5);
    for (const tag of external) {
      expect(tag).toContain('target="_blank"');
      expect(tag).toContain('rel="noopener noreferrer"');
    }
  });
});

describe("pie: enlaces", () => {
  it("paints no site navigation while no linked page exists", () => {
    expect(renderFooter()).not.toContain("Enlaces del sitio");
  });

  it("paints a link for a page of the map, in the language of the page", () => {
    const pages = [HOME, SHOP];

    expect(renderFooter({ pages })).toContain('href="/tienda"');
    expect(renderFooter({ at: "/en/", pages })).toContain('href="/en/shop"');
  });

  it("gives the navigation a name different from the header's and an anchor", () => {
    const html = renderFooter({ pages: [HOME, SHOP] });

    expect(html).toContain('aria-label="Enlaces del sitio"');
    expect(html).not.toContain('aria-label="Menú principal"');
    expect(html).toMatch(/<footer[^>]+id="pie"/);
  });

  it("keeps the anchor even with no navigation", () => {
    expect(renderFooter()).toMatch(/<footer[^>]+id="pie"/);
  });

  it("paints a column title only when the column has links", () => {
    const withoutLegal = renderFooter({ pages: [HOME, SHOP] });
    const withLegal = renderFooter({
      pages: [
        HOME,
        { id: "privacy", file: "routes/privacy.tsx", path: "privacidad" },
      ],
    });

    expect(withoutLegal).not.toContain(">Legal<");
    expect(withLegal).toContain(">Legal<");
  });
});

describe("pie: línea legal", () => {
  it("shows the year it receives", () => {
    expect(renderFooter({ year: 2031 })).toContain("2031");
  });
});

describe("pie: idioma", () => {
  it("lists both languages by full name and marks the current one", () => {
    const html = renderFooter({ at: "/en/" });

    expect(html).toContain(">Español<");
    expect(html).toMatch(/aria-current="true"[^>]*>English</);
  });

  it("names the footer language switcher differently from the header's", () => {
    const html = renderFooter();

    expect(html).toContain('aria-label="Idioma del sitio"');
    expect(html).not.toContain('aria-label="Idioma"');
  });
});

describe("pie: textos", () => {
  it("writes the legal line in English under /en/", () => {
    expect(renderFooter({ at: "/en/" })).toContain("Made in Colombia");
  });
});
