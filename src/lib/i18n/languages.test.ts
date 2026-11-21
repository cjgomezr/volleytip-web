import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguageFromPath,
  isSupportedLanguage,
} from "./languages";

describe("idiomas soportados", () => {
  it("incluye español e inglés", () => {
    expect(SUPPORTED_LANGUAGES.map(({ code }) => code)).toEqual(["es", "en"]);
  });

  it("tiene exactamente un idioma por defecto y es español", () => {
    const defaults = SUPPORTED_LANGUAGES.filter(({ isDefault }) => isDefault);

    expect(defaults).toHaveLength(1);
    expect(DEFAULT_LANGUAGE).toBe("es");
  });

  it("rechaza un código desconocido", () => {
    expect(isSupportedLanguage("fr")).toBe(false);
    expect(isSupportedLanguage("EN")).toBe(false);
    expect(isSupportedLanguage("en")).toBe(true);
  });
});

describe("idioma de una dirección", () => {
  it("la raíz es español", () => {
    expect(getLanguageFromPath("/")).toBe("es");
  });

  it.each(["/en", "/en/", "/en/algo"])("%s es inglés", (path) => {
    expect(getLanguageFromPath(path)).toBe("en");
  });

  it.each(["/english", "/EN/", "/fr/", "/es/algo", "/healthz"])(
    "%s es español por defecto",
    (path) => {
      expect(getLanguageFromPath(path)).toBe("es");
    },
  );

  it("reconoce un tercer idioma agregado a la lista", () => {
    const languages = [
      ...SUPPORTED_LANGUAGES,
      { code: "pt", isDefault: false },
    ];

    expect(getLanguageFromPath("/pt/x", languages)).toBe("pt");
  });
});
