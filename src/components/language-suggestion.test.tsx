import { describe, expect, it } from "vitest";

import { getTranslate } from "~/lib/i18n/messages.server";

import { LanguageSuggestion } from "./language-suggestion";
import { renderInRouter } from "./render-in-router";

function renderProposing(
  proposed: "es" | "en",
  pageLanguage: "es" | "en",
  at: string,
): string {
  return renderInRouter(
    <LanguageSuggestion
      proposed={proposed}
      pageLanguage={pageLanguage}
      texts={{
        label: getTranslate(proposed)("languageSuggestion.label"),
        message: getTranslate(proposed)("languageSuggestion.message"),
        accept: getTranslate(proposed)("languageSuggestion.accept"),
        stay: getTranslate(proposed)("languageSuggestion.stay"),
      }}
    />,
    at,
  );
}

describe("aviso de idioma: componente", () => {
  it("es una región con nombre, en el idioma que propone", () => {
    const html = renderProposing("en", "es", "/");

    expect(html).toMatch(/<section[^>]*aria-label="Language suggestion"/);
    expect(html).toContain('lang="en"');
  });

  it("muestra los textos del idioma propuesto, no los de la página", () => {
    const html = renderProposing("en", "es", "/");

    expect(html).toContain("This page is also available in English.");
    expect(html).toContain("View in English");
    expect(html).not.toContain("Ver en español");
  });

  it("propone español con textos en español desde una página en inglés", () => {
    const html = renderProposing("es", "en", "/en/");

    expect(html).toContain("Ver en español");
    expect(html).toContain("Esta página también está disponible en español.");
  });

  it("tiene dos acciones: aceptar el idioma propuesto y quedarse en el de la página", () => {
    const html = renderProposing("en", "es", "/");

    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/<form[^>]*action="\/idioma"/g)).toHaveLength(2);
    expect(html.match(/<form[^>]*method="post"/g)).toHaveLength(2);
    expect(html).toContain('name="language" value="en"');
    expect(html).toContain('name="language" value="es"');
  });

  it("envía la dirección actual con su búsqueda para volver a la misma página", () => {
    const html = renderProposing("en", "es", "/?a=1&b=2");

    expect(html).toContain('name="from" value="/?a=1&amp;b=2"');
  });

  it("no está fijo sobre el contenido", () => {
    const html = renderProposing("en", "es", "/");

    expect(html).not.toMatch(/\b(fixed|sticky|absolute)\b/);
  });
});
