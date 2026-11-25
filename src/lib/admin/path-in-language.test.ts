import { describe, expect, it } from "vitest";

import { PANEL_PAGES } from "../i18n/panel-pages";
import { getPanelPathInLanguage } from "./path-in-language";

const OPTIONS = { pages: PANEL_PAGES, fallback: "/en/admin" } as const;

describe("idioma del panel: la misma pantalla", () => {
  it.each([
    ["/admin", "en", "/en/admin"],
    ["/en/admin", "es", "/admin"],
    ["/admin/mas", "en", "/en/admin/more"],
    ["/en/admin/more?pagina=2", "es", "/admin/mas?pagina=2"],
    ["/admin", "es", "/admin"],
  ] as const)("de %s en %s lleva a %s", (from, language, destination) => {
    expect(getPanelPathInLanguage(from, language, OPTIONS)).toBe(destination);
  });

  it.each([
    "https://sitio-ajeno.test/admin",
    "//sitio-ajeno.test",
    "/admin/no-existe",
    "/contacto",
    "",
  ])("con %j lleva a la dirección de respaldo", (from) => {
    expect(getPanelPathInLanguage(from, "en", OPTIONS)).toBe("/en/admin");
  });
});
