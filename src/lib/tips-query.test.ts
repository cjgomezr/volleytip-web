import { describe, expect, it } from "vitest";

import { TIP_FUNDAMENTALS, TIP_LEVELS } from "./tips";
import {
  buildTipsSearch,
  hasTipFilters,
  parseTipsQuery,
  translateTipsSearch,
  type TipsQuery,
} from "./tips-query";

function parse(search: string, language: "es" | "en" = "es"): TipsQuery {
  return parseTipsQuery(new URLSearchParams(search), language);
}

const NO_FILTERS: TipsQuery = { query: "", page: 1 };

describe("listado de tips: filtros", () => {
  it("AC-024: lee fundamento y nivel combinados en español", () => {
    expect(parse("fundamento=recepcion&nivel=basico")).toEqual({
      fundamental: "reception",
      level: "basic",
      query: "",
      page: 1,
    });
  });

  it("lee los nombres y valores del inglés en la página en inglés", () => {
    expect(parse("skill=reception&level=basic", "en")).toEqual({
      fundamental: "reception",
      level: "basic",
      query: "",
      page: 1,
    });
  });

  it("no lee en una página los nombres del otro idioma", () => {
    expect(parse("skill=reception&level=basic")).toEqual(NO_FILTERS);
  });

  it.each(["fundamento=magia", "nivel=experto", "fundamento=reception"])(
    "ignora el valor inexistente de %j",
    (search) => {
      expect(parse(search)).toEqual(NO_FILTERS);
    },
  );

  it("un valor inválido no quita el otro filtro", () => {
    expect(parse("fundamento=magia&nivel=basico")).toEqual({
      level: "basic",
      query: "",
      page: 1,
    });
  });

  it("no toma por valor el nombre de una propiedad de los objetos", () => {
    expect(parse("fundamento=constructor&nivel=toString")).toEqual(NO_FILTERS);
  });

  it.each(["es", "en"] as const)(
    "cada fundamento y nivel va y vuelve de la dirección en %s",
    (language) => {
      for (const fundamental of TIP_FUNDAMENTALS) {
        for (const level of TIP_LEVELS) {
          const query = { fundamental, level, query: "", page: 1 };

          const search = buildTipsSearch(query, language);

          expect(parse(search, language)).toEqual(query);
        }
      }
    },
  );

  it("arma la dirección con los nombres del idioma", () => {
    const query: TipsQuery = {
      fundamental: "reception",
      level: "basic",
      query: "",
      page: 1,
    };

    expect(buildTipsSearch(query, "es")).toBe(
      "?fundamento=recepcion&nivel=basico",
    );
    expect(buildTipsSearch(query, "en")).toBe("?skill=reception&level=basic");
  });

  it("sin filtros, búsqueda ni página no deja nada en la dirección", () => {
    expect(buildTipsSearch(NO_FILTERS, "es")).toBe("");
  });

  it("sabe si hay filtros o búsqueda", () => {
    expect(hasTipFilters(NO_FILTERS)).toBe(false);
    expect(hasTipFilters({ ...NO_FILTERS, page: 3 })).toBe(false);
    expect(hasTipFilters({ ...NO_FILTERS, level: "basic" })).toBe(true);
    expect(hasTipFilters({ ...NO_FILTERS, fundamental: "serve" })).toBe(true);
    expect(hasTipFilters({ ...NO_FILTERS, query: "saque" })).toBe(true);
  });
});

describe("listado de tips: el cambio de idioma conserva los filtros", () => {
  it("traduce nombres y valores del español al inglés", () => {
    expect(
      translateTipsSearch(
        "?fundamento=recepcion&nivel=basico&buscar=saque+flotado&pagina=2",
        "es",
        "en",
      ),
    ).toBe("?skill=reception&level=basic&search=saque+flotado&page=2");
  });

  it("traduce del inglés al español", () => {
    expect(translateTipsSearch("?skill=block&level=advanced", "en", "es")).toBe(
      "?fundamento=bloqueo&nivel=avanzado",
    );
  });

  it("descarta un valor inválido y conserva lo que no es del listado", () => {
    expect(
      translateTipsSearch("?fundamento=magia&utm_source=ig", "es", "en"),
    ).toBe("?utm_source=ig");
  });

  it("hacia el mismo idioma no cambia nada", () => {
    expect(translateTipsSearch("?nivel=basico", "es", "es")).toBe(
      "?nivel=basico",
    );
  });

  it("sin parámetros no agrega nada", () => {
    expect(translateTipsSearch("", "es", "en")).toBe("");
  });
});

describe("listado de tips: búsqueda en la dirección", () => {
  it("recorta a 100 caracteres sin partir un emoji", () => {
    const text = `${"a".repeat(99)}🏐sobra`;

    expect(parse(`buscar=${encodeURIComponent(text)}`).query).toBe(
      `${"a".repeat(99)}🏐`,
    );
  });

  it("quita los espacios del borde y el carácter nulo", () => {
    expect(parse("buscar=%20%00saque%20%20").query).toBe("saque");
  });

  it.each(["%", "_", "<script>alert(1)</script>", "') or 1=1 --"])(
    "trata %j como texto",
    (text) => {
      expect(parse(`buscar=${encodeURIComponent(text)}`).query).toBe(text);
    },
  );
});

describe("listado de tips: paginación en la dirección", () => {
  it("lee la página", () => {
    expect(parse("pagina=3").page).toBe(3);
    expect(parse("page=3", "en").page).toBe(3);
  });

  it.each(["0", "-2", "1.5", "dos", "", "1e3", "99999999999999999999"])(
    "con la página %j abre la primera",
    (page) => {
      expect(parse(`pagina=${page}`).page).toBe(1);
    },
  );
});
