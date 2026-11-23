import { describe, expect, it } from "vitest";

import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  isCountryCode,
  listCountries,
} from "./countries";

describe("lista de países", () => {
  it("usa Colombia como país por defecto", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("CO");
    expect(isCountryCode(DEFAULT_COUNTRY_CODE)).toBe(true);
  });

  it("acepta un código de la lista y rechaza lo demás", () => {
    expect(isCountryCode("MX")).toBe(true);
    expect(isCountryCode("mx")).toBe(false);
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode("")).toBe(false);
  });

  it("no repite códigos y todos son dos letras mayúsculas", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("nombra cada país en el idioma pedido", () => {
    const spanish = listCountries("es");
    const english = listCountries("en");

    expect(spanish.find(({ code }) => code === "ES")?.name).toBe("España");
    expect(english.find(({ code }) => code === "ES")?.name).toBe("Spain");
    expect(spanish).toHaveLength(COUNTRY_CODES.length);
  });

  it("ordena los países por nombre en el idioma pedido", () => {
    const names = listCountries("es").map(({ name }) => name);

    expect(names).toEqual(
      [...names].sort((first, second) => first.localeCompare(second, "es")),
    );
  });
});
