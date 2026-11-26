import { describe, expect, it } from "vitest";

import { ADMIN_MODULES, defineModules, type AdminModule } from "./modules";
import { buildPanelNavigation, type NavigationRequest } from "./navigation";

function buildModule(
  id: string,
  overrides: Partial<AdminModule> = {},
): AdminModule {
  return {
    id,
    page: { id, file: "routes/panel/home.tsx", path: `admin/${id}` },
    labelKey: "panel.module.overview",
    requiredRole: "admin",
    ...overrides,
  };
}

const IN_BAR = { bottomBar: { glyph: "⌂" } } as const;

function navigate(
  modules: readonly AdminModule[],
  request: Partial<NavigationRequest> = {},
): ReturnType<typeof buildPanelNavigation> {
  return buildPanelNavigation(modules, {
    role: "admin",
    language: "es",
    pathname: "/admin",
    pendingCounts: {},
    morePath: "/admin/mas",
    ...request,
  });
}

function ids(entries: readonly { readonly id: string }[]): string[] {
  return entries.map(({ id }) => id);
}

describe("módulos del panel", () => {
  it("la lista real empieza en Resumen y sigue el orden del menú", () => {
    const { sidebar } = navigate(ADMIN_MODULES);

    expect(ids(sidebar)).toEqual([
      "overview",
      "site-texts",
      "settings",
      "audit-log",
    ]);
    expect(sidebar[2]?.href).toBe("/admin/ajustes");
    expect(sidebar[0]?.href).toBe("/admin");
    expect(navigate(ADMIN_MODULES, { language: "en" }).sidebar[0]?.href).toBe(
      "/en/admin",
    );
  });

  it("Resumen va en la barra inferior y lo demás en 'Más'", () => {
    const { bar, more } = navigate(ADMIN_MODULES);

    expect(ids(bar)).toEqual(["overview"]);
    expect(ids(more)).toEqual(["site-texts", "settings", "audit-log"]);
  });

  it("el menú sale de la lista y respeta el orden", () => {
    const modules = [buildModule("c"), buildModule("a"), buildModule("b")];

    expect(ids(navigate(modules).sidebar)).toEqual(["c", "a", "b"]);
  });

  it("reparte entre la barra y 'Más' según la marca de cada módulo", () => {
    const modules = [
      buildModule("a", IN_BAR),
      buildModule("b"),
      buildModule("c", IN_BAR),
    ];

    const { bar, more } = navigate(modules);

    expect(ids(bar)).toEqual(["a", "c"]);
    expect(ids(more)).toEqual(["b"]);
  });

  it("lo que no cabe en la barra pasa a 'Más'", () => {
    const modules = ["a", "b", "c", "d", "e", "f"].map((id) =>
      buildModule(id, IN_BAR),
    );

    const { bar, more } = navigate(modules);

    expect(ids(bar)).toEqual(["a", "b", "c", "d"]);
    expect(ids(more)).toEqual(["e", "f"]);
  });

  it("un módulo de admin no aparece para el staff", () => {
    const modules = [
      buildModule("solo-admin", IN_BAR),
      buildModule("equipo", { requiredRole: "staff" }),
    ];

    const { sidebar, bar, more } = navigate(modules, { role: "staff" });

    expect(ids(sidebar)).toEqual(["equipo"]);
    expect(bar).toEqual([]);
    expect(ids(more)).toEqual(["equipo"]);
    expect(ids(navigate(modules).sidebar)).toEqual(["solo-admin", "equipo"]);
  });

  it("hoy el staff no ve ningún módulo", () => {
    expect(navigate(ADMIN_MODULES, { role: "staff" }).sidebar).toEqual([]);
  });

  it("un contador declarado se entrega con su número", () => {
    const modules = [buildModule("a", { hasPendingCounter: true })];

    const { sidebar } = navigate(modules, { pendingCounts: { a: 3 } });

    expect(sidebar[0]?.pendingCount).toBe(3);
  });

  it("un contador en cero no se entrega", () => {
    const modules = [buildModule("a", { hasPendingCounter: true })];

    const { sidebar } = navigate(modules, { pendingCounts: { a: 0 } });

    expect(sidebar[0]?.pendingCount).toBeUndefined();
  });

  it("un módulo sin contador no muestra número", () => {
    const { sidebar } = navigate([buildModule("a")], {
      pendingCounts: { a: 5 },
    });

    expect(sidebar[0]?.pendingCount).toBeUndefined();
  });

  it.each([
    ["/admin/mensajes", "mensajes"],
    ["/admin/mensajes/", "mensajes"],
    ["/admin/mensajes/7", "mensajes"],
    ["/admin", "overview"],
    ["/admin/mensajes-viejos", "overview"],
  ])("en %s el módulo actual es %s", (pathname, current) => {
    const modules = [
      buildModule("overview", { page: { id: "o", file: "x", path: "admin" } }),
      buildModule("mensajes"),
    ];

    const { sidebar } = navigate(modules, { pathname });

    expect(ids(sidebar.filter(({ isCurrent }) => isCurrent))).toEqual([
      current,
    ]);
  });

  it("en 'Más' ningún módulo es el actual", () => {
    const modules = [
      buildModule("overview", { page: { id: "o", file: "x", path: "admin" } }),
    ];

    const { sidebar, isMorePage } = navigate(modules, {
      pathname: "/admin/mas",
    });

    expect(isMorePage).toBe(true);
    expect(sidebar.some(({ isCurrent }) => isCurrent)).toBe(false);
  });

  it("ids repetidos fallan", () => {
    expect(() => defineModules([buildModule("a"), buildModule("a")])).toThrow(
      /"a"/,
    );
  });
});
