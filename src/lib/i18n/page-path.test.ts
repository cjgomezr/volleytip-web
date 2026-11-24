import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES, type Language } from "./languages";
import {
  buildPagePath,
  findPageAtPath,
  type PageDeclaration,
} from "./page-path";
import { getPageAtPath, getPagePath, PAGES } from "./pages";

const SPANISH = { code: "es", isDefault: true };
const ENGLISH = { code: "en", isDefault: false };
const LANGUAGES = [SPANISH, ENGLISH];

const HOME: PageDeclaration = { id: "home", file: "home.tsx", path: "" };
const SHOP: PageDeclaration = {
  id: "shop",
  file: "shop.tsx",
  path: { es: "tienda", en: "shop" },
};
const PRODUCT: PageDeclaration = {
  id: "product",
  file: "product.tsx",
  path: { es: "tienda/:slug", en: "shop/:slug" },
};
const HEALTH: PageDeclaration = { id: "faq", file: "faq.tsx", path: "faq" };

describe("dirección de una página", () => {
  it.each([
    [HOME, SPANISH, "/"],
    [HOME, ENGLISH, "/en/"],
    [SHOP, SPANISH, "/tienda"],
    [SHOP, ENGLISH, "/en/shop"],
    [HEALTH, SPANISH, "/faq"],
    [HEALTH, ENGLISH, "/en/faq"],
  ])("la página %o en %o es %s", (page, language, expected) => {
    expect(buildPagePath(page, language)).toBe(expected);
  });

  it("pone los parámetros de ruta en su lugar, en cada idioma", () => {
    const params = { slug: "balon-oficial" };

    expect(buildPagePath(PRODUCT, SPANISH, params)).toBe(
      "/tienda/balon-oficial",
    );
    expect(buildPagePath(PRODUCT, ENGLISH, params)).toBe(
      "/en/shop/balon-oficial",
    );
  });

  it("codifica un parámetro para que no cambie la dirección", () => {
    expect(buildPagePath(PRODUCT, SPANISH, { slug: "a/b ?c" })).toBe(
      "/tienda/a%2Fb%20%3Fc",
    );
  });

  it.each([[{}], [{ slug: "" }], [{ otro: "x" }]])(
    "falla y nombra el parámetro cuando falta: %o",
    (params) => {
      expect(() => buildPagePath(PRODUCT, SPANISH, params)).toThrow(/"slug"/);
    },
  );

  it("falla si a la página le falta el nombre de la sección en ese idioma", () => {
    const untranslated = { ...SHOP, path: { es: "tienda" } };

    expect(() => buildPagePath(untranslated, ENGLISH)).toThrow(/"shop".*"en"/);
  });

  it.each(SUPPORTED_LANGUAGES.map(({ code }) => code))(
    "cada página del mapa real tiene dirección en %s",
    (language: Language) => {
      for (const { id } of PAGES) {
        expect(getPagePath(id, language, { code: "abc123" })).toMatch(/^\//);
      }
    },
  );

  it("la home real es / en español y /en/ en inglés", () => {
    expect(getPagePath("home", "es")).toBe("/");
    expect(getPagePath("home", "en")).toBe("/en/");
  });

  it("una página que no está en el mapa no compila", () => {
    // @ts-expect-error "no-existe" no es una página del mapa.
    expect(() => getPagePath("no-existe", "es")).toThrow(/"no-existe"/);
  });
});

describe("página de una dirección", () => {
  const PAGES_SAMPLE = [HOME, SHOP, PRODUCT];

  it.each([
    ["/", "home", "es", {}],
    ["/en", "home", "en", {}],
    ["/en/", "home", "en", {}],
    ["/tienda", "shop", "es", {}],
    ["/tienda/", "shop", "es", {}],
    ["//", "home", "es", {}],
    ["/en//", "home", "en", {}],
    ["/en/shop", "shop", "en", {}],
    ["/tienda/balon", "product", "es", { slug: "balon" }],
    ["/en/shop/bal%C3%B3n", "product", "en", { slug: "balón" }],
    ["/%65n/shop", "shop", "en", {}],
  ])("%s es la página %s en %s", (path, id, language, params) => {
    const match = findPageAtPath(path, PAGES_SAMPLE, LANGUAGES);

    expect(match?.page.id).toBe(id);
    expect(match?.language).toBe(language);
    expect(match?.params).toEqual(params);
  });

  it.each([
    "/no-existe",
    "/en/tienda",
    "/shop",
    "/EN/",
    "/Tienda",
    "/es/tienda",
    "/tienda/balon/extra",
    // React Router da 404 con una barra doble al comienzo o en medio.
    "//en",
    "/en//shop",
    "/tienda//balon",
    "/en/shop/%E0%A4%A",
  ])("%s no es de ninguna página", (path) => {
    expect(findPageAtPath(path, PAGES_SAMPLE, LANGUAGES)).toBeUndefined();
  });

  it("una dirección vuelve a salir igual al armarla con lo que se encontró", () => {
    const match = findPageAtPath("/en/shop/balon", PAGES_SAMPLE, LANGUAGES);

    expect(match && buildPagePath(match.page, ENGLISH, match.params)).toBe(
      "/en/shop/balon",
    );
  });

  it("en el mapa real, / y /en/ son la home y lo demás no es una página", () => {
    expect(getPageAtPath("/")).toEqual({ page: "home", params: {} });
    expect(getPageAtPath("/en/")).toEqual({ page: "home", params: {} });
    expect(getPageAtPath("/dev/componentes")).toBeUndefined();
    expect(getPageAtPath("/healthz")).toBeUndefined();
  });
});
