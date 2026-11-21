import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES, type LanguageDefinition } from "./languages";
import { buildLocalizedRoutes, type PageDeclaration } from "./route-map";

const HOME: PageDeclaration = { id: "home", file: "routes/home.tsx", path: "" };
const TIPS: PageDeclaration = {
  id: "tips",
  file: "routes/tips.tsx",
  path: { es: "tips", en: "tips" },
};
const ABOUT: PageDeclaration = {
  id: "about",
  file: "routes/about.tsx",
  path: { es: "nosotros", en: "about-us" },
};

function pathsOf(
  pages: readonly PageDeclaration[],
  languages: readonly LanguageDefinition[] = SUPPORTED_LANGUAGES,
): (string | undefined)[] {
  return buildLocalizedRoutes(pages, languages).map(({ path }) => path);
}

describe("mapa de rutas", () => {
  it("produce una ruta por idioma para cada página declarada una vez", () => {
    expect(pathsOf([HOME, TIPS])).toEqual([undefined, "tips", "en", "en/tips"]);
  });

  it("usa el nombre de sección de cada idioma", () => {
    expect(pathsOf([ABOUT])).toEqual(["nosotros", "en/about-us"]);
  });

  it("no crea la sección española bajo el prefijo inglés", () => {
    expect(pathsOf([ABOUT])).not.toContain("en/nosotros");
  });

  it("un idioma agregado en la prueba produce sus rutas", () => {
    const languages = [
      ...SUPPORTED_LANGUAGES,
      { code: "pt", isDefault: false },
    ];

    expect(pathsOf([HOME], languages)).toEqual([undefined, "en", "pt"]);
  });

  it("cada ruta tiene un id único por idioma", () => {
    const ids = buildLocalizedRoutes([HOME, TIPS], SUPPORTED_LANGUAGES).map(
      ({ id }) => id,
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rechaza una página a la que le falta el nombre en un idioma", () => {
    const onlySpanish: PageDeclaration = {
      id: "shop",
      file: "routes/shop.tsx",
      path: { es: "tienda" },
    };

    expect(() =>
      buildLocalizedRoutes([onlySpanish], SUPPORTED_LANGUAGES),
    ).toThrow(/"shop".*"en"/);
  });

  it("rechaza un nombre vacío en un idioma: solo la home va en la raíz", () => {
    const emptyEnglish: PageDeclaration = {
      id: "shop",
      file: "routes/shop.tsx",
      path: { es: "tienda", en: "" },
    };

    expect(() =>
      buildLocalizedRoutes([emptyEnglish], SUPPORTED_LANGUAGES),
    ).toThrow(/"shop".*"en"/);
  });

  it("rechaza dos páginas con la misma dirección en un idioma", () => {
    const clash: PageDeclaration = { id: "other", file: "x.tsx", path: "tips" };

    expect(() =>
      buildLocalizedRoutes([TIPS, clash], SUPPORTED_LANGUAGES),
    ).toThrow(/tips/);
  });
});
