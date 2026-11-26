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
    ["adminSignInLink", "/admin/entrar/enlace", "/en/admin/sign-in/link"],
    ["adminSignOut", "/admin/salir", "/en/admin/sign-out"],
    ["adminMore", "/admin/mas", "/en/admin/more"],
    ["adminLanguage", "/admin/idioma", "/en/admin/language"],
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
      "admin/entrar/enlace",
      "admin/idioma",
      "admin/mas",
      "admin/salir",
      "admin/textos",
      "admin/textos/barra",
      "admin/textos/cifras",
      "en/admin",
      "en/admin/*",
      "en/admin/language",
      "en/admin/more",
      "en/admin/sign-in",
      "en/admin/sign-in/link",
      "en/admin/sign-out",
      "en/admin/site-texts",
      "en/admin/site-texts/announcements",
      "en/admin/site-texts/figures",
    ]);
  });

  it("solo la entrada queda fuera de la guardia", () => {
    expect(pathsInside("routes/panel/member-layout.tsx")).toEqual([
      "admin",
      "admin/*",
      "admin/idioma",
      "admin/mas",
      "admin/salir",
      "admin/textos",
      "admin/textos/barra",
      "admin/textos/cifras",
      "en/admin",
      "en/admin/*",
      "en/admin/language",
      "en/admin/more",
      "en/admin/sign-out",
      "en/admin/site-texts",
      "en/admin/site-texts/announcements",
      "en/admin/site-texts/figures",
    ]);
  });

  it("lo que cuelga del panel es solo de admin", () => {
    expect(pathsInside("routes/panel/admin-layout.tsx")).toEqual([
      "admin/*",
      "admin/idioma",
      "admin/mas",
      "admin/textos",
      "admin/textos/barra",
      "admin/textos/cifras",
      "en/admin/*",
      "en/admin/language",
      "en/admin/more",
      "en/admin/site-texts",
      "en/admin/site-texts/announcements",
      "en/admin/site-texts/figures",
    ]);
  });

  it("no están en el mapa de páginas del que saldrá el sitemap", () => {
    expect(PAGES.filter(({ id }) => id.startsWith("admin"))).toEqual([]);
    expect(getPageAtPath("/admin")).toBeUndefined();
    expect(getPageAtPath("/en/admin/sign-in")).toBeUndefined();
  });
});
