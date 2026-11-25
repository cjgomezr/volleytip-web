import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, UNSAFE_ErrorResponseImpl } from "react-router";
import { describe, expect, it } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";

import { ErrorBoundary } from "./root";

function renderHiddenPage(
  language: Language,
  path: string,
  languageSuggestion: object | null = null,
): string {
  const error = new UNSAFE_ErrorResponseImpl(404, "Not Found", {
    kind: "panel-not-found",
    messages: getMessages(language),
    year: 2026,
    announcements: ["Aviso de prueba"],
    languageSuggestion,
  });
  const Stub = createRoutesStub([
    { path, Component: () => <ErrorBoundary error={error} params={{}} /> },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

describe("404 que ve un buyer en el panel (AC-033)", () => {
  it("lleva la cáscara y el texto de una página que no existe", () => {
    const html = renderHiddenPage("es", "/admin");

    expect(html).toContain("Balón fuera");
    expect(html).toContain("Aviso de prueba");
    expect(html).toContain("<header");
    expect(html).toContain("<footer");
    expect(html).not.toContain("Cerrar sesión");
  });

  it("lleva el aviso de idioma como cualquier página que no existe", () => {
    const html = renderHiddenPage("es", "/admin", {
      proposed: "en",
      pageLanguage: "es",
      texts: {
        label: "Language",
        message: "This page is also in English.",
        accept: "View in English",
        stay: "Stay",
      },
    });

    expect(html).toContain("This page is also in English.");
  });

  it("sale en inglés bajo /en/", () => {
    expect(renderHiddenPage("en", "/en/admin")).toContain("Out of bounds");
  });
});
