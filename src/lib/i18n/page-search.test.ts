import { describe, expect, it } from "vitest";

import { translatePageSearch } from "./page-search";

describe("listado de tips: filtros al cambiar de idioma", () => {
  it("traduce los parámetros del listado de tips", () => {
    expect(
      translatePageSearch({
        page: "tips",
        search: "?fundamento=recepcion&nivel=basico",
        from: "es",
        to: "en",
      }),
    ).toBe("?skill=reception&level=basic");
  });

  it("deja igual la búsqueda de las demás páginas", () => {
    expect(
      translatePageSearch({
        page: "contact",
        search: "?motivo=otro",
        from: "es",
        to: "en",
      }),
    ).toBe("?motivo=otro");
  });
});
