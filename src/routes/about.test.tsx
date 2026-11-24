import { afterEach, describe, expect, it, vi } from "vitest";

import type { SiteStat } from "~/lib/site-stats.server";

import { loader, meta } from "./about";

vi.mock("~/lib/site-stats.server", () => ({ readSiteStats: vi.fn() }));
const { readSiteStats } = await import("~/lib/site-stats.server");
const readSiteStatsMock = vi.mocked(readSiteStats);

const STATS: readonly SiteStat[] = [
  {
    id: "tiktok",
    value: "530K",
    valueLanguage: "es",
    label: "seguidores en TikTok",
    labelLanguage: "es",
  },
];

function loadAbout(path: string): ReturnType<typeof loader> {
  return loader({
    request: new Request(`http://localhost${path}`),
  } as Parameters<typeof loader>[0]);
}

afterEach(() => {
  readSiteStatsMock.mockReset();
  vi.restoreAllMocks();
});

describe("nosotros: loader", () => {
  it("devuelve las cifras del idioma de la petición con el lector de la home", async () => {
    readSiteStatsMock.mockResolvedValue(STATS);

    const data = await loadAbout("/en/about");

    expect(readSiteStatsMock).toHaveBeenCalledWith("en");
    expect(data.stats).toEqual(STATS);
    expect(data.language).toBe("en");
  });

  it("sigue sin cifras cuando la base falla", async () => {
    readSiteStatsMock.mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const data = await loadAbout("/nosotros");

    expect(data.stats).toEqual([]);
  });

  it("da título y descripción en el idioma de la dirección", async () => {
    readSiteStatsMock.mockResolvedValue([]);

    const spanish = await loadAbout("/nosotros");
    const english = await loadAbout("/en/about");

    expect(spanish.title).not.toBe(english.title);
    expect(spanish.description).not.toBe(english.description);
    expect(
      meta({ loaderData: english } as Parameters<typeof meta>[0]),
    ).toEqual([
      { title: english.title },
      { name: "description", content: english.description },
    ]);
  });
});
