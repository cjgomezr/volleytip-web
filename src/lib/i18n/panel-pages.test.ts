import type { RouteConfigEntry } from "@react-router/dev/routes";
import { describe, expect, it } from "vitest";

import routes from "../../routes";
import { getPageAtPath, PAGES } from "./pages";
import { getPanelPath, isPanelPath } from "./panel-pages";

function flatten(entries: readonly RouteConfigEntry[]): RouteConfigEntry[] {
  return entries.flatMap((entry) => [entry, ...flatten(entry.children ?? [])]);
}

function pathsInside(file: string): string[] {
  const layout = flatten(routes).find((entry) => entry.file === file);
  if (layout === undefined) throw new Error(`No hay una ruta con ${file}`);
  return flatten(layout.children ?? [])
    .flatMap((entry) => (entry.path === undefined ? [] : [entry.path]))
    .sort();
}

describe("direcciones del panel", () => {
  it.each([
    ["adminHome", "/admin", "/en/admin"],
    ["adminSignIn", "/admin/entrar", "/en/admin/sign-in"],
    ["adminSignOut", "/admin/salir", "/en/admin/sign-out"],
  ] as const)("%s vive en %s y %s", (page, spanish, english) => {
    expect(getPanelPath(page, "es")).toBe(spanish);
    expect(getPanelPath(page, "en")).toBe(english);
  });

  it.each(["/admin", "/admin/", "/admin/a/b", "/en/admin", "/en/admin/x"])(
    "%s es del panel",
    (path) => {
      expect(isPanelPath(path)).toBe(true);
    },
  );

  it.each(["/", "/administracion", "/en/administration", "/es/admin"])(
    "%s no es del panel",
    (path) => {
      expect(isPanelPath(path)).toBe(false);
    },
  );
});

describe("rutas del panel", () => {
  it("van fuera de la cáscara del sitio", () => {
    expect(
      pathsInside("routes/site-layout.tsx").filter((path) =>
        path.includes("admin"),
      ),
    ).toEqual([]);
  });

  it("todas pasan por la sesión del panel, en los dos idiomas", () => {
    expect(pathsInside("routes/panel/session-layout.tsx")).toEqual([
      "admin",
      "admin/*",
      "admin/entrar",
      "admin/salir",
      "en/admin",
      "en/admin/*",
      "en/admin/sign-in",
      "en/admin/sign-out",
    ]);
  });

  it("solo la entrada queda fuera de la guardia", () => {
    expect(pathsInside("routes/panel/member-layout.tsx")).toEqual([
      "admin",
      "admin/*",
      "admin/salir",
      "en/admin",
      "en/admin/*",
      "en/admin/sign-out",
    ]);
  });

  it("lo que cuelga del panel es solo de admin", () => {
    expect(pathsInside("routes/panel/admin-layout.tsx")).toEqual([
      "admin/*",
      "en/admin/*",
    ]);
  });

  it("no están en el mapa de páginas del que saldrá el sitemap", () => {
    expect(PAGES.filter(({ id }) => id.startsWith("admin"))).toEqual([]);
    expect(getPageAtPath("/admin")).toBeUndefined();
    expect(getPageAtPath("/en/admin/sign-in")).toBeUndefined();
  });
});
