import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTipsListing } from "./tips-listing.server";
import type { Tip } from "./tips.server";
import type { TipsQuery } from "./tips-query";

vi.mock("./tips.server", () => ({
  TIPS_PAGE_SIZE: 20,
  listPublishedTips: vi.fn(),
  countPublishedTips: vi.fn(),
  readLatestTip: vi.fn(),
}));
const { listPublishedTips, countPublishedTips, readLatestTip } =
  await import("./tips.server");
const listMock = vi.mocked(listPublishedTips);
const countMock = vi.mocked(countPublishedTips);
const latestMock = vi.mocked(readLatestTip);

function buildTip(number: number): Tip {
  return {
    id: `id-${number}`,
    slug: `tip-${number}`,
    bunnyVideoId: `video-${number}`,
    orientation: "vertical",
    durationSeconds: 52,
    thumbnailUrl: `https://miniaturas.prueba.volleytip.test/${number}.jpg`,
    fundamental: "reception",
    level: "basic",
    tiktokUrl: null,
    promo: null,
    isFeatured: false,
    publishedAt: "2026-11-01T12:00:00+00:00",
    text: {
      title: `Tip ${number}`,
      achievement: "Recibe mejor",
      keys: ["Una clave"],
      commonError: null,
      practice: null,
    },
    textLanguages: {
      title: "es",
      achievement: "es",
      keys: "es",
      commonError: "es",
      practice: "es",
    },
  };
}

const NO_FILTERS: TipsQuery = { query: "", page: 1 };

function stubTips({
  tips = [buildTip(1)],
  total = tips.length,
  publishedTotal = total,
}: { tips?: Tip[]; total?: number; publishedTotal?: number } = {}): void {
  listMock.mockResolvedValue({ tips, total });
  countMock.mockResolvedValue(publishedTotal);
  latestMock.mockResolvedValue(tips[0] ?? null);
}

afterEach(() => vi.resetAllMocks());

describe("listado de tips: lectura", () => {
  it("entrega de cada tip solo lo que la tarjeta pinta", async () => {
    stubTips();

    const listing = await loadTipsListing("es", NO_FILTERS);

    expect(listing.tips).toEqual([
      {
        id: "id-1",
        slug: "tip-1",
        title: "Tip 1",
        titleLanguage: "es",
        thumbnailUrl: "https://miniaturas.prueba.volleytip.test/1.jpg",
        durationSeconds: 52,
        fundamental: "reception",
        level: "basic",
      },
    ]);
  });

  it("pide a la base los filtros y la búsqueda en el idioma de la página", async () => {
    stubTips();

    await loadTipsListing("en", {
      fundamental: "reception",
      level: "basic",
      query: "saque",
      page: 1,
    });

    expect(listMock).toHaveBeenCalledWith("en", {
      fundamental: "reception",
      level: "basic",
      query: "saque",
      offset: 0,
    });
  });

  it("sin filtros no cuenta dos veces: el total es el de publicados", async () => {
    stubTips({ total: 7 });

    const listing = await loadTipsListing("es", NO_FILTERS);

    expect(listing.publishedTotal).toBe(7);
    expect(countMock).not.toHaveBeenCalled();
  });

  it("con filtros el encabezado sigue diciendo cuántos publicados hay", async () => {
    stubTips({ total: 2, publishedTotal: 30 });

    const listing = await loadTipsListing("es", {
      ...NO_FILTERS,
      level: "basic",
    });

    expect(listing.total).toBe(2);
    expect(listing.publishedTotal).toBe(30);
  });
});

describe("listado de tips: paginación", () => {
  it("la segunda página empieza en el tip 21", async () => {
    stubTips({ total: 45 });

    await loadTipsListing("es", { ...NO_FILTERS, page: 2 });

    expect(listMock).toHaveBeenCalledWith("es", { query: "", offset: 20 });
  });

  it.each([
    [1, 20, false],
    [1, 21, true],
    [2, 40, false],
    [2, 41, true],
    [3, 41, false],
  ])(
    "en la página %i de %i tips ofrece cargar más: %s",
    async (page, total, hasNextPage) => {
      stubTips({ total });

      const listing = await loadTipsListing("es", { ...NO_FILTERS, page });

      expect(listing.hasNextPage).toBe(hasNextPage);
    },
  );
});

describe("listado de tips: último video", () => {
  it("sin filtros trae el último video con su frase", async () => {
    stubTips();

    const listing = await loadTipsListing("es", NO_FILTERS);

    expect(latestMock).toHaveBeenCalledWith("es");
    expect(listing.latestTip).toMatchObject({
      slug: "tip-1",
      achievement: "Recibe mejor",
      achievementLanguage: "es",
    });
  });

  it("al cargar más no lo lee", async () => {
    stubTips();

    const listing = await loadTipsListing(
      "es",
      { ...NO_FILTERS, page: 2 },
      { withLatest: false },
    );

    expect(listing.latestTip).toBeNull();
    expect(latestMock).not.toHaveBeenCalled();
  });

  it.each<Partial<TipsQuery>>([
    { fundamental: "serve" },
    { level: "basic" },
    { query: "saque" },
  ])("con %j no lo muestra ni lo lee", async (filter) => {
    stubTips();

    const listing = await loadTipsListing("es", { ...NO_FILTERS, ...filter });

    expect(listing.latestTip).toBeNull();
    expect(latestMock).not.toHaveBeenCalled();
  });
});
