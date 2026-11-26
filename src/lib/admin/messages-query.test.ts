import { describe, expect, it } from "vitest";

import {
  buildInboxSearch,
  hasInboxFilters,
  parseInboxQuery,
  type InboxQuery,
} from "./messages";

const NO_FILTERS: InboxQuery = {
  reason: null,
  status: null,
  search: "",
  page: 1,
};

function parse(search: string): InboxQuery {
  return parseInboxQuery(new URLSearchParams(search));
}

describe("bandeja: filtros en la dirección", () => {
  it("sin parámetros no filtra y está en la página 1", () => {
    expect(parse("")).toEqual(NO_FILTERS);
  });

  it("lee motivo, estado, búsqueda y página juntos", () => {
    expect(parse("motivo=order&estado=new&q=Laura&pagina=3")).toEqual({
      reason: "order",
      status: "new",
      search: "Laura",
      page: 3,
    });
  });

  it.each([
    "motivo=pedido",
    "motivo=",
    "estado=spam",
    "estado=NEW",
    "pagina=0",
    "pagina=-1",
    "pagina=2.5",
    "pagina=dos",
    "pagina=99999999999999999999",
    "otro=1",
  ])("ignora el valor desconocido de %s", (search) => {
    expect(parse(search)).toEqual(NO_FILTERS);
  });

  it("limpia la búsqueda: espacios, caracteres de control y largo", () => {
    expect(parse(`q=${encodeURIComponent("  la\u0000u\nra  ")}`).search).toBe(
      "la u ra",
    );
    expect(parse(`q=${"a".repeat(400)}`).search).toHaveLength(254);
  });

  it("escribe en la dirección solo lo que filtra", () => {
    expect(buildInboxSearch(NO_FILTERS)).toBe("");
    expect(
      buildInboxSearch({
        reason: "brands",
        status: "archived",
        search: "a&b c",
        page: 2,
      }),
    ).toBe("?motivo=brands&estado=archived&q=a%26b+c&pagina=2");
  });

  it("lo que escribe se vuelve a leer igual", () => {
    const query: InboxQuery = {
      reason: "vball_tour",
      status: "answered",
      search: "ana@correo.com",
      page: 4,
    };

    expect(parse(buildInboxSearch(query))).toEqual(query);
  });

  it("la página sola no cuenta como filtro", () => {
    expect(hasInboxFilters({ ...NO_FILTERS, page: 3 })).toBe(false);
    expect(hasInboxFilters({ ...NO_FILTERS, status: "new" })).toBe(true);
    expect(hasInboxFilters({ ...NO_FILTERS, reason: "other" })).toBe(true);
    expect(hasInboxFilters({ ...NO_FILTERS, search: "a" })).toBe(true);
  });
});
