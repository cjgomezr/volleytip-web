import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { PanelMarket } from "~/lib/admin/markets";
import { SAMPLE_MARKETS_VIEW } from "~/lib/admin/sample-markets";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { MarketsScreen, type MarketsScreenProps } from "./markets-screen";

function render(
  props: Partial<MarketsScreenProps> = {},
  language: Language = "es",
): string {
  const path = language === "es" ? "/admin/mercados" : "/en/admin/markets";
  function Screen(): ReactElement {
    return (
      <TranslationsProvider
        language={language}
        messages={getMessages(language)}
      >
        <MarketsScreen {...SAMPLE_MARKETS_VIEW} {...props} />
      </TranslationsProvider>
    );
  }
  const Stub = createRoutesStub([{ path, Component: Screen }]);
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

function findSampleMarket(): PanelMarket {
  const [market] = SAMPLE_MARKETS_VIEW.markets;
  if (market === undefined) throw new Error("La muestra no tiene mercados.");
  return market;
}

const COLOMBIA = findSampleMarket();

function findTags(html: string, tag: string, attribute: string): string[] {
  return html.match(new RegExp(`<${tag} [^>]*${attribute}[^>]*>`, "g")) ?? [];
}

describe("pantalla de idiomas y mercados", () => {
  it("lista los idiomas con su estado y cuál es el de por defecto", () => {
    const html = render();

    expect(html).toContain("Español");
    expect(html).toContain("English");
    expect(html).toContain("Por defecto");
    expect(html).toContain("Activo");
  });

  it("explica que el idioma por defecto no se desactiva y no le pone botón", () => {
    const html = render();

    expect(html).toContain("no se puede desactivar");
    expect(html).toContain("Desactivar English");
    expect(html).not.toContain("Desactivar Español");
  });

  it("ofrece activar un idioma desactivado", () => {
    const html = render({
      languages: SAMPLE_MARKETS_VIEW.languages.map((language) =>
        language.isDefault ? language : { ...language, isActive: false },
      ),
    });

    expect(html).toContain("Activar English");
    expect(html).toContain("Desactivado");
  });

  it("muestra cada mercado con sus datos", () => {
    const html = render();

    expect(html).toContain("Colombia (CO)");
    expect(html).toContain("Moneda: COP");
    expect(html).toContain("Recibe envíos físicos");
    expect(html).toContain("Botón Bancolombia");
    expect(findTags(html, "input", 'value="card"')[0]).toContain("checked");
    expect(findTags(html, "input", 'value="nequi"')[0]).not.toContain(
      "checked",
    );
  });

  it("solo ofrece como idioma de un mercado los activos", () => {
    const html = render({
      languages: SAMPLE_MARKETS_VIEW.languages.map((language) =>
        language.isDefault ? language : { ...language, isActive: false },
      ),
    });

    expect(findTags(html, "option", 'value="es"')).toHaveLength(1);
    expect(findTags(html, "option", 'value="en"')).toEqual([]);
  });

  it("pide elegir si el idioma de un mercado ya no está activo", () => {
    const html = render({
      languages: SAMPLE_MARKETS_VIEW.languages.map((language) =>
        language.isDefault ? language : { ...language, isActive: false },
      ),
      markets: [{ ...COLOMBIA, defaultLocale: "en" }],
    });

    expect(html).toMatch(
      /<option value="" selected="">Elige un idioma<\/option>/,
    );
  });

  it("muestra la tasa actual y su campo", () => {
    const html = render();

    expect(html).toContain("Tasa actual: 4150 pesos por dólar.");
    expect(findTags(html, "input", 'name="rate"')[0]).toContain('value="4150"');
  });

  it("dice cuando no hay tasa", () => {
    const html = render({ usdRate: { state: "missing", value: "" } });

    expect(html).toContain("Sin tasa guardada");
  });

  it("no ofrece crear ni borrar idiomas ni mercados", () => {
    const html = render();

    expect(html).not.toMatch(/Agregar|Crear|Borrar|Eliminar|Quitar/);
  });

  it("explica el rechazo del único mercado activo junto a su casilla", () => {
    const html = render({
      marketOutcome: {
        status: "invalid",
        id: COLOMBIA.id,
        values: { ...COLOMBIA, isActive: false },
        errors: {},
        formError: "lastActiveMarket",
      },
    });

    expect(html).toContain("Es el único mercado activo");
    const [checkbox = ""] = findTags(html, "input", 'type="checkbox"');
    expect(checkbox).toContain('aria-invalid="true"');
    expect(checkbox).toContain("aria-describedby");
    expect(checkbox).not.toContain("checked");
  });

  it("pinta el error de la tasa junto al campo, con lo escrito", () => {
    const html = render({
      rateOutcome: {
        status: "invalid",
        value: "4.000",
        error: "notPositiveInteger",
      },
    });

    const [field = ""] = findTags(html, "input", 'name="rate"');
    expect(field).toContain('aria-invalid="true"');
    expect(field).toContain('value="4.000"');
    expect(html).toContain("Escribe un número entero mayor que cero");
  });

  it("pinta junto al selector el error de un idioma desactivado", () => {
    const html = render({
      marketOutcome: {
        status: "invalid",
        id: COLOMBIA.id,
        values: COLOMBIA,
        errors: { defaultLocale: "inactiveLanguage" },
        formError: null,
      },
    });

    expect(findTags(html, "select", 'name="defaultLocale"')[0]).toContain(
      'aria-invalid="true"',
    );
    expect(html).toContain("Elige un idioma activo.");
  });

  it("explica el rechazo del idioma por defecto", () => {
    const html = render({
      languageOutcome: {
        status: "invalid",
        code: "es",
        error: "defaultLanguage",
      },
    });

    expect(html).toContain("No se puede desactivar el idioma por defecto");
  });

  it("anuncia que el cambio de un idioma quedó guardado", () => {
    const html = render({
      languageOutcome: { status: "saved", code: "en" },
    });

    expect(html).toMatch(/role="status"[^>]*><p[^>]*>.*?Cambios guardados/);
  });

  it("la región del anuncio ya está en la página antes de guardar, sin ocultarla", () => {
    const html = render();

    const [region = ""] = findTags(html, "div", 'role="status"');
    expect(region).toContain("empty:sr-only");
    expect(region).not.toContain("hidden");
  });

  it("sale en inglés bajo /en/", () => {
    const html = render({}, "en");

    expect(html).toContain("Languages and markets");
    expect(html).toContain("Deactivate English");
  });
});
