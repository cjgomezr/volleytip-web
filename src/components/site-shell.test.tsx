import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { SiteShell } from "./site-shell";

function renderShell(at: string): string {
  const language = at.startsWith("/en") ? "en" : "es";
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[at]}>
      <TranslationsProvider
        language={language}
        messages={getMessages(language)}
      >
        <SiteShell>
          <p>contenido de la página</p>
        </SiteShell>
      </TranslationsProvider>
    </MemoryRouter>,
  );
}

describe("cáscara", () => {
  it("carries the header and a single main around the page", () => {
    const html = renderShell("/");

    expect(html).toContain("<header");
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toMatch(/<main[^>]*>[\s\S]*contenido de la página/);
  });

  it("puts the skip link before everything else, pointing at the main", () => {
    const html = renderShell("/");
    const target = /<main[^>]+id="([^"]+)"/.exec(html)?.[1];

    expect(target).toBeDefined();
    expect(html).toMatch(
      new RegExp(`<a[^>]+href="#${target}"[^>]*>Saltar al contenido</a>`),
    );
    // Lo único que puede ir antes son los <link> que React sube al <head>.
    expect(html.replace(/<link[^>]*>/g, "")).toMatch(/^<a /);
  });

  it("writes the skip link in English under /en/", () => {
    expect(renderShell("/en/")).toContain("Skip to content");
  });
});
