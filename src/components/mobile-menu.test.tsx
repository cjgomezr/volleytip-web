import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { getMessages } from "~/lib/i18n/messages.server";
import type { PageDeclaration } from "~/lib/i18n/page-path";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { SOCIAL_NETWORKS } from "~/lib/social-links";

import { MobileMenu } from "./mobile-menu";

const PAGES: readonly PageDeclaration[] = [
  { id: "home", file: "routes/home.tsx", path: "" },
  { id: "tips", file: "routes/tips.tsx", path: "tips" },
  { id: "about", file: "routes/about.tsx", path: "nosotros" },
];

function renderMenu(at: string): string {
  const language = at.startsWith("/en") ? "en" : "es";
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[at]}>
      <TranslationsProvider
        language={language}
        messages={getMessages(language)}
      >
        <MobileMenu pages={PAGES} />
      </TranslationsProvider>
    </MemoryRouter>,
  );
}

describe("menú de celular: marcado", () => {
  it("offers a link to the footer navigation until JavaScript arrives", () => {
    const html = renderMenu("/");

    expect(html).toMatch(/<a[^>]+href="#pie"[^>]*aria-label="Abrir menú"/);
    expect(html).not.toMatch(/<button[^>]+aria-expanded/);
  });

  it("shows the opener only below 768 px", () => {
    expect(renderMenu("/")).toMatch(/<a[^>]+class="[^"]*md:hidden/);
  });

  it("announces the dialog with a name", () => {
    expect(renderMenu("/")).toMatch(/<dialog[^>]+aria-label="Menú"/);
    expect(renderMenu("/en/")).toMatch(/<dialog[^>]+aria-label="Menu"/);
  });

  it("lists the same entries as the inline menu, in the same order", () => {
    const menu =
      renderMenu("/").match(
        /<nav aria-label="Menú principal".*?<\/nav>/,
      )?.[0] ?? "";
    const labels = [...menu.matchAll(/>([^<]+)<\/a>/g)].map(
      (match) => match[1],
    );
    expect(labels).toEqual(["Tips", "Nosotros"]);
  });

  it("marks the current page", () => {
    expect(renderMenu("/tips")).toMatch(
      /<a[^>]+aria-current="page"[^>]*>Tips<\/a>/,
    );
  });

  it("ends with the language switcher and the social icons", () => {
    const html = renderMenu("/");

    expect(html).toContain('aria-label="Idioma del menú"');
    for (const { href } of SOCIAL_NETWORKS) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html.indexOf("Idioma del menú")).toBeGreaterThan(
      html.indexOf("Nosotros"),
    );
  });

  it("writes its texts in English under /en/", () => {
    const html = renderMenu("/en/");

    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain("Close menu");
    expect(html).not.toContain("Abrir menú");
  });
});
