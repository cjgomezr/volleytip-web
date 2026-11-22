import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { PageDeclaration } from "~/lib/i18n/page-path";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { SiteHeader } from "./site-header";

const HOME: PageDeclaration = { id: "home", file: "routes/home.tsx", path: "" };
const TIPS: PageDeclaration = {
  id: "tips",
  file: "routes/tips.tsx",
  path: "tips",
};

function renderHeader(
  at: string,
  pages: readonly PageDeclaration[] = [HOME],
): string {
  const language = at.startsWith("/en") ? "en" : "es";
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[at]}>
      <TranslationsProvider
        language={language}
        messages={getMessages(language)}
      >
        <SiteHeader pages={pages} />
      </TranslationsProvider>
    </MemoryRouter>,
  );
}

describe("header", () => {
  it("links the logo to the home of the current language", () => {
    expect(renderHeader("/")).toMatch(/<a[^>]+href="\/"[^>]*><img/);
    expect(renderHeader("/en/")).toMatch(/<a[^>]+href="\/en\/"[^>]*><img/);
  });

  it("gives the logo link an accessible name", () => {
    expect(renderHeader("/")).toContain('aria-label="VolleyTip, ir al inicio"');
    expect(renderHeader("/en/")).toContain('aria-label="VolleyTip, go home"');
  });

  it("paints no menu nav while no entry has a page", () => {
    const html = renderHeader("/");

    expect(html).not.toContain('aria-label="Menú principal"');
    expect(html.match(/<nav/g)).toHaveLength(1);
  });

  it("paints the menu when an entry has a page", () => {
    const html = renderHeader("/", [HOME, TIPS]);

    expect(html).toContain('aria-label="Menú principal"');
    expect(html).toMatch(/<a[^>]+href="\/tips"[^>]*>Tips<\/a>/);
  });

  it("marks the entry of the current page with aria-current", () => {
    const html = renderHeader("/tips", [HOME, TIPS]);

    expect(html).toMatch(/<a[^>]+aria-current="page"[^>]*>Tips<\/a>/);
  });

  it("does not mark an entry when another page is current", () => {
    expect(renderHeader("/", [HOME, TIPS])).not.toContain(
      'aria-current="page"',
    );
  });

  it("writes its texts in English under /en/", () => {
    const html = renderHeader("/en/tips", [HOME, TIPS]);

    expect(html).toContain("Main menu");
    expect(html).not.toContain("Menú principal");
  });

  it("includes the language switcher", () => {
    expect(renderHeader("/")).toContain('aria-label="Idioma"');
  });

  it("shows the menu inline from 768 px and not below", () => {
    expect(renderHeader("/", [HOME, TIPS])).toMatch(
      /<nav[^>]+class="[^"]*hidden md:block/,
    );
  });
});
