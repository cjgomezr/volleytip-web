import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SiteStat } from "~/lib/site-stats.server";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import Home, { loader, meta, type HomeData } from "./home";

vi.mock("~/lib/site-stats.server", () => ({ readSiteStats: vi.fn() }));
const { readSiteStats } = await import("~/lib/site-stats.server");
const readSiteStatsMock = vi.mocked(readSiteStats);

type Language = "es" | "en";

const STATS: readonly SiteStat[] = [
  {
    id: "instagram",
    value: "116K",
    valueLanguage: "es",
    label: "seguidores en Instagram",
    labelLanguage: "es",
  },
  {
    id: "tiktok",
    value: "530K",
    valueLanguage: "es",
    label: "seguidores en TikTok",
    labelLanguage: "es",
  },
];

function buildData(overrides: Partial<HomeData> = {}): HomeData {
  return {
    title: "VolleyTip",
    description: "d",
    language: "es",
    stats: STATS,
    cdnHost: "imagenes-de-prueba.b-cdn.net",
    ...overrides,
  };
}

function renderHome(
  language: Language,
  data = buildData({ language }),
): string {
  return renderToStaticMarkup(
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <Home {...({ loaderData: data } as Parameters<typeof Home>[0])} />
    </TranslationsProvider>,
  );
}

function loadHome(path: string): ReturnType<typeof loader> {
  return loader({
    request: new Request(`http://localhost${path}`),
  } as Parameters<typeof loader>[0]);
}

afterEach(() => {
  readSiteStatsMock.mockReset();
});

describe("home: loader", () => {
  it("devuelve las cifras del idioma de la petición", async () => {
    readSiteStatsMock.mockResolvedValue(STATS);

    const data = await loadHome("/en/");

    expect(readSiteStatsMock).toHaveBeenCalledWith("en");
    expect(data.stats).toEqual(STATS);
    expect(data.language).toBe("en");
  });

  it("sigue sin cifras cuando la base falla", async () => {
    readSiteStatsMock.mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const data = await loadHome("/");

    expect(data.stats).toEqual([]);
  });

  it("da título y descripción en el idioma de la dirección", async () => {
    readSiteStatsMock.mockResolvedValue([]);

    const spanish = await loadHome("/");
    const english = await loadHome("/en/");

    expect(spanish.description).toContain("Tips de voleibol");
    expect(english.description).toContain("Volleyball tips");
    expect(meta({ loaderData: english } as Parameters<typeof meta>[0])).toEqual(
      [
        { title: english.title },
        { name: "description", content: english.description },
      ],
    );
  });
});

describe("home: héroe", () => {
  it("tiene un solo h1 con el título", () => {
    const html = renderHome("es");

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Aprende voley en");
  });

  it("lleva el botón principal a TikTok en otra pestaña", () => {
    const html = renderHome("es");

    expect(html).toMatch(
      /<a[^>]+href="https:\/\/www\.tiktok\.com\/@volleytip"[^>]+target="_blank"[^>]+rel="noopener noreferrer"[^>]*>Ver los tips/,
    );
  });

  it("muestra las cuatro redes y no WhatsApp", () => {
    const html = renderHome("en");

    for (const name of ["TikTok", "Instagram", "YouTube", "Facebook"]) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    expect(html).not.toContain("wa.me");
  });

  it("ya no enlaza al estado del servicio", () => {
    expect(renderHome("es")).not.toContain("/healthz");
  });
});

describe("home: cifras", () => {
  it("pinta cada cifra con su valor y su leyenda", () => {
    const html = renderHome("es");

    expect(html).toContain("116K");
    expect(html).toContain("seguidores en TikTok");
  });

  it("marca con lang la leyenda que cayó al español en la página en inglés", () => {
    const html = renderHome("en");

    expect(html).toMatch(/lang="es"[^>]*>seguidores en Instagram/);
  });

  it("no pinta el bloque cuando no hay cifras", () => {
    const html = renderHome("es", buildData({ stats: [] }));

    expect(html).not.toContain("VolleyTip en cifras");
  });
});

describe("home: nosotros", () => {
  it("muestra titular y texto en el idioma de la página", () => {
    expect(renderHome("es")).toContain("El voley es para todos");
    expect(renderHome("en")).toContain("Volleyball is for everyone");
  });

  it("pinta la foto con alt, ancho, alto y carga perezosa", () => {
    const html = renderHome("es");

    expect(html).toMatch(/<img[^>]+alt="Camilo[^"]+"/);
    expect(html).toMatch(/<img[^>]+width="640"[^>]+height="427"/);
    expect(html).toContain('loading="lazy"');
  });

  it("no enlaza al equipo mientras Nosotros no exista en el mapa de páginas", () => {
    expect(renderHome("es")).not.toContain("Conoce al equipo");
  });
});
