import { describe, expect, it, vi } from "vitest";

import type { TipCardData, TipsListing } from "./tips-listing.server";
import {
  appendTipsPage,
  isLoadMoreRequest,
  readReportingFailure,
  toLoadMoreHref,
  type AppendedTips,
} from "./tips-load-more";

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

const PAGE_URL = "http://localhost/tips?pagina=2";

describe("listado de tips: paginación cuando cargar más falla", () => {
  const request = new Request(`http://localhost${toLoadMoreHref("/tips")}`);

  it.each([
    ["/tips?pagina=2", "/tips?pagina=2&"],
    ["/tips", "/tips?"],
  ])("marca el pedido de %s", (href, start) => {
    const marked = toLoadMoreHref(href);

    expect(marked.startsWith(start)).toBe(true);
    expect(isLoadMoreRequest(new Request(`http://localhost${marked}`))).toBe(
      true,
    );
    expect(isLoadMoreRequest(new Request(`http://localhost${href}`))).toBe(
      false,
    );
  });

  it.each([
    ["la red", new TypeError("Failed to fetch")],
    ["el servidor", new Error("Unexpected Server Error")],
  ])("si falla %s lo devuelve como resultado", async (_what, failure) => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await readReportingFailure(request, () =>
      Promise.reject(failure),
    );

    expect(result).toEqual({ hasFailed: true });
    expect(report).toHaveBeenCalledWith(expect.any(String), failure);
    report.mockRestore();
  });

  it("deja seguir una redirección", async () => {
    const redirect = new Response(null, { status: 302 });

    await expect(
      readReportingFailure(request, () => Promise.reject(redirect)),
    ).rejects.toBe(redirect);
  });

  it("una navegación que falla sigue hasta la página de error", async () => {
    const failure = new Error("sin base");

    await expect(
      readReportingFailure(new Request(PAGE_URL), () =>
        Promise.reject(failure),
      ),
    ).rejects.toBe(failure);
  });

  it("si todo va bien entrega lo que leyó", async () => {
    await expect(
      readReportingFailure(request, () => Promise.resolve("datos")),
    ).resolves.toBe("datos");
  });
});
