import { describe, expect, it } from "vitest";

import { getPreferredLanguage } from "./browser-language";

describe("idioma preferido del navegador", () => {
  it("devuelve el idioma de una sola preferencia", () => {
    expect(getPreferredLanguage("en")).toBe("en");
  });

  it("gana la de más peso que el sitio soporta", () => {
    expect(getPreferredLanguage("fr;q=0.9,es;q=0.5,en;q=0.7")).toBe("en");
  });

  it("sin peso explícito vale 1 y se respeta el orden en un empate", () => {
    expect(getPreferredLanguage("es,en")).toBe("es");
    expect(getPreferredLanguage("en,es")).toBe("en");
  });

  it("cuenta en-US y en-GB como en", () => {
    expect(getPreferredLanguage("en-US")).toBe("en");
    expect(getPreferredLanguage("EN-gb,fr")).toBe("en");
  });

  it("devuelve undefined si ninguna está soportada", () => {
    expect(getPreferredLanguage("fr,de;q=0.8,*;q=0.1")).toBeUndefined();
  });

  it("ignora una preferencia con peso 0", () => {
    expect(getPreferredLanguage("en;q=0,fr")).toBeUndefined();
  });

  it("devuelve undefined con la cabecera ausente, vacía o solo espacios", () => {
    expect(getPreferredLanguage(null)).toBeUndefined();
    expect(getPreferredLanguage("")).toBeUndefined();
    expect(getPreferredLanguage("   ")).toBeUndefined();
  });

  it("devuelve undefined con una cabecera enorme", () => {
    expect(getPreferredLanguage(`fr,`.repeat(5000) + "en")).toBeUndefined();
  });

  it("no falla con una cabecera mal formada", () => {
    for (const header of [
      ";;;",
      "en;q=abc",
      ",,,",
      "en;q=",
      "q=0.5",
      "\u0000",
    ]) {
      expect(() => getPreferredLanguage(header)).not.toThrow();
    }
    expect(getPreferredLanguage("en;q=abc,es;q=0.2")).toBe("es");
  });

  it("ignora un peso fuera de rango", () => {
    expect(getPreferredLanguage("en;q=7,es;q=0.5")).toBe("es");
  });
});
