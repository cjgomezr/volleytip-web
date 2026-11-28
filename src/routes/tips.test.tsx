import { afterEach, describe, expect, it, vi } from "vitest";

import type { TipsListing } from "~/lib/tips-listing.server";
import { toLoadMoreHref } from "~/lib/tips-load-more";
import type { TipsQuery } from "~/lib/tips-query";

import { loader, meta } from "./tips";

vi.mock("~/lib/tips-listing.server", () => ({ loadTipsListing: vi.fn() }));
const { loadTipsListing } = await import("~/lib/tips-listing.server");
const listingMock = vi.mocked(loadTipsListing);

function stubListing(overrides: Partial<TipsListing> = {}): void {
  listingMock.mockImplementation(async (_language, query: TipsQuery) => ({
    query,
    publishedTotal: 45,
    total: 45,
    tips: [
      {
        id: "1",
        slug: "uno",
        title: "Uno",
        titleLanguage: "es",
        thumbnailUrl: "https://miniaturas.prueba.volleytip.test/uno.jpg",
        durationSeconds: 38,
        fundamental: "serve",
        level: "basic",
      },
    ],
    latestTip: null,
    hasNextPage: true,
    ...overrides,
  }));
}

function loadTips(path: string): ReturnType<typeof loader> {
  const request = new Request(`http://localhost${path}`);
  // Como React Router: la petición llega cruda y `url`, sin lo suyo.
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\.data$/, "");
  url.searchParams.delete("_routes");
  return loader({ request, url } as Parameters<typeof loader>[0]);
}

async function readData(path: string): Promise<{
  readonly title: string;
  readonly description: string;
  readonly language: string;
  readonly listing: TipsListing;
}> {
  const result = await loadTips(path);
  if (result instanceof Response) throw new Error("No se esperaba redirigir.");
  return result;
}

afterEach(() => listingMock.mockReset());

describe("listado de tips: loader", () => {
  it("AC-024: lee los filtros de la dirección en el idioma de la página", async () => {
    stubListing();

    await readData("/tips?fundamento=recepcion&nivel=basico");

    expect(listingMock).toHaveBeenCalledWith(
      "es",
      { fundamental: "reception", level: "basic", query: "", page: 1 },
      { withLatest: true },
    );
  });

  it("en inglés lee los nombres en inglés", async () => {
    stubListing();

    const data = await readData("/en/tips?skill=reception&search=serve");

    expect(data.language).toBe("en");
    expect(listingMock).toHaveBeenCalledWith(
      "en",
      { fundamental: "reception", query: "serve", page: 1 },
      { withLatest: true },
    );
  });

  it("ignora un filtro que no existe y carga la página", async () => {
    stubListing();

    await readData("/tips?fundamento=magia");

    expect(listingMock).toHaveBeenCalledWith(
      "es",
      { query: "", page: 1 },
      { withLatest: true },
    );
  });

  it("una página más allá de la última lleva a la primera con los mismos filtros", async () => {
    stubListing({ tips: [], total: 45, hasNextPage: false });

    const result = await loadTips("/tips?nivel=basico&pagina=9");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe(
      "/tips?nivel=basico",
    );
  });

  it("al volver a la primera conserva lo que no es del listado", async () => {
    stubListing({ tips: [], total: 45, hasNextPage: false });

    const result = await loadTips("/tips?utm_source=ig&pagina=9");

    expect((result as Response).headers.get("Location")).toBe(
      "/tips?utm_source=ig",
    );
  });

  it("al navegar sin recargar no deja en la dirección lo de React Router", async () => {
    stubListing({ tips: [], total: 45, hasNextPage: false });

    const result = await loadTips("/tips.data?pagina=9&_routes=tips.es");

    expect((result as Response).headers.get("Location")).toBe("/tips");
  });

  it("'Cargar más' de una página que quedó vacía no redirige ni lee el último video", async () => {
    stubListing({ tips: [], total: 40, hasNextPage: false });

    const data = await readData(toLoadMoreHref("/tips?pagina=3"));

    expect(data.listing.tips).toEqual([]);
    expect(listingMock).toHaveBeenCalledWith(
      "es",
      { query: "", page: 3 },
      { withLatest: false },
    );
  });

  it("sin resultados en la primera página no redirige", async () => {
    stubListing({ tips: [], total: 0, hasNextPage: false });

    const data = await readData("/tips?pagina=3");

    expect(data.listing.total).toBe(0);
  });
});

describe("listado de tips: meta", () => {
  it("tiene título y descripción propios por idioma", async () => {
    stubListing();

    const spanish = await readData("/tips");
    const english = await readData("/en/tips");

    expect(spanish.title).toBe("Tips de voleibol · VolleyTip");
    expect(english.title).toBe("Volleyball tips · VolleyTip");
    expect(spanish.description).not.toBe(english.description);
    expect(meta({ loaderData: english } as Parameters<typeof meta>[0])).toEqual(
      [
        { title: english.title },
        { name: "description", content: english.description },
      ],
    );
  });
});
