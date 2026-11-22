import { describe, expect, it } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import type { UsdApproximation } from "~/lib/usd-approximation";

import { PriceApproximation } from "./price-approximation";
import { renderInRouter } from "./render-in-router";

function render(approximation: UsdApproximation, language: Language): string {
  return renderInRouter(
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <PriceApproximation approximation={approximation} />
    </TranslationsProvider>,
  );
}

const TWELVE: UsdApproximation = { kind: "approximate", dollars: 12 };

describe("precio aproximado: componente", () => {
  it("dice ≈ US$12 y la nota del cobro en pesos, en español", () => {
    const html = render(TWELVE, "es");

    expect(html).toContain("≈ US$12");
    expect(html).toContain("El cobro es en pesos colombianos.");
  });

  it("dice lo mismo en inglés", () => {
    const html = render(TWELVE, "en");

    expect(html).toContain("≈ US$12");
    expect(html).toContain("You are charged in Colombian pesos.");
  });

  it("dice menos de US$1 y no US$0", () => {
    const html = render({ kind: "lessThanOneDollar" }, "es");

    expect(html).toContain("menos de US$1");
    expect(html).not.toContain("US$0");
  });

  it("el lector de pantalla lee una frase y no el símbolo ≈", () => {
    const html = render(TWELVE, "es");

    expect(html).toMatch(/<span aria-hidden="true">≈ US\$12<\/span>/);
    expect(html).toMatch(
      /<span class="sr-only">aproximadamente 12 dólares<\/span>/,
    );
  });

  it("usa el singular con un dólar", () => {
    const html = render({ kind: "approximate", dollars: 1 }, "es");

    expect(html).toContain("aproximadamente 1 dólar<");
  });

  it("no pinta nada cuando no hay aproximado", () => {
    expect(render({ kind: "none" }, "es")).toBe("");
  });
});
