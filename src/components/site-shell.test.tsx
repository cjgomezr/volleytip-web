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
        <SiteShell year={2026}>
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

  it("ends the page with the footer, after the main", () => {
    const html = renderShell("/");

    expect(html.lastIndexOf("</main>")).toBeLessThan(html.indexOf("<footer"));
    // Después del pie solo cierra la columna que envuelve la cáscara.
    expect(html.trimEnd()).toMatch(/<\/footer><\/div>$/);
  });

  it("puts the skip link before everything else, pointing at the main", () => {
    const html = renderShell("/");
    const target = /<main[^>]+id="([^"]+)"/.exec(html)?.[1];

    expect(target).toBeDefined();
    expect(html).toMatch(
      new RegExp(`<a[^>]+href="#${target}"[^>]*>Saltar al contenido</a>`),
    );
    // Lo único que puede ir antes son los <link> que React sube al <head> y
    // la columna que envuelve la cáscara: el enlace es su primer hijo.
    expect(html.replace(/<link[^>]*>/g, "")).toMatch(/^<div [^>]*><a /);
  });

  it("writes the skip link in English under /en/", () => {
    expect(renderShell("/en/")).toContain("Skip to content");
  });
});

describe("cáscara: barra de anuncios", () => {
  function renderWith(announcements: readonly string[] | undefined): string {
    return renderToStaticMarkup(
      <MemoryRouter>
        <TranslationsProvider language="es" messages={getMessages("es")}>
          <SiteShell announcements={announcements} year={2026}>
            <p>página</p>
          </SiteShell>
        </TranslationsProvider>
      </MemoryRouter>,
    );
  }

  it("pinta la barra con los mensajes antes del header", () => {
    const html = renderWith(["Envío gratis"]);

    expect(html).toContain("Envío gratis");
    expect(html.indexOf("Envío gratis")).toBeLessThan(html.indexOf("<header"));
  });

  it("no deja ningún elemento sin mensajes", () => {
    expect(renderWith([])).not.toContain("bg-brand-lime text-brand-night");
    expect(renderWith(undefined)).not.toContain('<ul class="mx-auto flex');
  });

  it("pinta como texto un mensaje con etiquetas HTML", () => {
    const html = renderWith(["<script>alert(1)</script>"]);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
