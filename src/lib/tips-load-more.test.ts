import { describe, expect, it } from "vitest";

import type { TipCardData, TipsListing } from "./tips-listing.server";
import { appendTipsPage, type AppendedTips } from "./tips-load-more";

function buildCard(number: number): TipCardData {
  return {
    id: `id-${number}`,
    slug: `tip-${number}`,
    title: `Tip ${number}`,
    titleLanguage: "es",
    thumbnailUrl: "https://miniaturas.prueba.volleytip.test/uno.jpg",
    durationSeconds: 40,
    fundamental: "serve",
    level: "basic",
  };
}

function buildListing(
  page: number,
  numbers: readonly number[],
  hasNextPage = true,
): TipsListing {
  return {
    query: { query: "", page },
    publishedTotal: 60,
    total: 60,
    tips: numbers.map(buildCard),
    latestTip: null,
    hasNextPage,
  };
}

function start(listing: TipsListing): AppendedTips {
  return {
    extra: [],
    page: listing.query.page,
    hasNextPage: listing.hasNextPage,
    added: [],
  };
}

describe("listado de tips: paginación al cargar más", () => {
  const first = buildListing(1, [1, 2]);

  it("agrega los siguientes a los que ya estaban", () => {
    const appended = appendTipsPage(
      start(first),
      first.tips,
      buildListing(2, [3, 4], false),
    );

    expect(appended.extra.map(({ id }) => id)).toEqual(["id-3", "id-4"]);
    expect(appended.added.map(({ id }) => id)).toEqual(["id-3", "id-4"]);
    expect(appended.page).toBe(2);
    expect(appended.hasNextPage).toBe(false);
  });

  it("no repite un tip que se corrió de página porque se publicó otro", () => {
    const appended = appendTipsPage(
      start(first),
      first.tips,
      buildListing(2, [2, 3]),
    );

    expect(appended.added.map(({ id }) => id)).toEqual(["id-3"]);
  });

  it("junta una tercera página sin perder la segunda", () => {
    const second = appendTipsPage(
      start(first),
      first.tips,
      buildListing(2, [3]),
    );

    const third = appendTipsPage(second, first.tips, buildListing(3, [3, 4]));

    expect(third.extra.map(({ id }) => id)).toEqual(["id-3", "id-4"]);
    expect(third.added.map(({ id }) => id)).toEqual(["id-4"]);
  });

  it.each([1, 2, 3, 5])(
    "con tres páginas a la vista ignora la página %i",
    (page) => {
      const shown = start(buildListing(3, [1]));

      expect(appendTipsPage(shown, [], buildListing(page, [9]))).toBe(shown);
    },
  );
});
