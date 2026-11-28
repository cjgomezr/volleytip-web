import { describe, expect, it } from "vitest";

import { getTipPath, getTipsListPath } from "./tips-path";

describe("listado de tips: direcciones", () => {
  it.each([
    ["es", "/tips/saque-flotado"],
    ["en", "/en/tips/saque-flotado"],
  ] as const)("la página de un tip en %s es %s", (language, path) => {
    expect(getTipPath(language, "saque-flotado")).toBe(path);
  });

  it("el listado filtrado lleva los nombres del idioma", () => {
    expect(
      getTipsListPath("en", { level: "basic", query: "serve", page: 2 }),
    ).toBe("/en/tips?level=basic&search=serve&page=2");
  });

  it("el listado sin nada es la dirección de la página", () => {
    expect(getTipsListPath("es", { query: "", page: 1 })).toBe("/tips");
  });
});
