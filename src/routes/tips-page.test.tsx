import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { LanguageAlternates } from "~/components/language-alternates";
import { SiteHeader } from "~/components/site-header";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import type { TipCardData, TipsListing } from "~/lib/tips-listing.server";

import { TipsPage } from "./tips-page";

function buildCard(
  number: number,
  overrides: Partial<TipCardData> = {},
): TipCardData {
  return {
    id: `id-${number}`,
    slug: `tip-${number}`,
    title: `Título ${number}`,
    titleLanguage: "es",
    thumbnailUrl: `https://miniaturas.prueba.volleytip.test/${number}.jpg`,
    durationSeconds: 62,
    fundamental: "reception",
    level: "intermediate",
    ...overrides,
  };
}

function buildListing(overrides: Partial<TipsListing> = {}): TipsListing {
  return {
    query: { query: "", page: 1 },
    publishedTotal: 2,
    total: 2,
    tips: [buildCard(1), buildCard(2)],
    latestTip: {
      ...buildCard(9, { title: "El destacado" }),
      achievement: "Recibe sin miedo",
      achievementLanguage: "es",
    },
    hasNextPage: false,
    ...overrides,
  };
}

function renderInSite(element: React.ReactElement, at: string): string {
  const language: Language = at.startsWith("/en") ? "en" : "es";
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          {element}
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={[at]} />);
}

function render(overrides: Partial<TipsListing> = {}, at = "/tips"): string {
  const language: Language = at.startsWith("/en") ? "en" : "es";
  return renderInSite(
    <TipsPage listing={buildListing(overrides)} language={language} />,
    at,
  );
}

function linkWith(html: string, text: string): string {
  const links = html.match(/<a [^>]*>(?:(?!<\/a>)[\s\S])*<\/a>/g) ?? [];
  const found = links.find((link) => link.includes(`>${text}<`));
  if (found === undefined) throw new Error(`No hay enlace "${text}".`);
  return found;
}

describe("listado de tips: lectura", () => {
  it("cada tip muestra miniatura, duración, fundamento, título y nivel, con enlace a su página", () => {
    const html = render({ latestTip: null });
    const card = linkWith(html, "Título 1");

    expect(card).toContain('href="/tips/tip-1"');
    expect(card).toMatch(
      /<img(?=[^>]*src="https:\/\/miniaturas\.prueba\.volleytip\.test\/1\.jpg")(?=[^>]*alt="")(?=[^>]*width="\d+")(?=[^>]*height="\d+")(?=[^>]*loading="lazy")[^>]*>/,
    );
    expect(card).toContain("1:02");
    expect(card).toContain("Recepción");
    expect(card).toContain("Intermedio");
  });

  it("los pinta en el orden en que llegan, del más reciente al más antiguo", () => {
    const html = render();

    expect(html.indexOf("Título 1")).toBeLessThan(html.indexOf("Título 2"));
  });

  it("en inglés enlaza en inglés y marca el título que quedó en español", () => {
    const html = render({ latestTip: null }, "/en/tips");

    expect(html).toContain('href="/en/tips/tip-1"');
    expect(html).toMatch(/<h3[^>]*lang="es"[^>]*>Título 1<\/h3>/);
    expect(html).toContain("Intermediate");
  });
});

describe("listado de tips: encabezado", () => {
  it.each([
    [105, "105 videos cortos"],
    [1, "1 video corto"],
  ])("con %i publicados dice %j", (publishedTotal, text) => {
    expect(render({ publishedTotal })).toContain(text);
  });

  it("sin publicados no cuenta videos", () => {
    const html = render({
      publishedTotal: 0,
      total: 0,
      tips: [],
      latestTip: null,
    });

    expect(html).not.toContain("videos cortos");
  });
});

describe("listado de tips: filtros", () => {
  const filtered: Partial<TipsListing> = {
    query: { fundamental: "reception", level: "basic", query: "", page: 1 },
    latestTip: null,
  };

  it("marca los filtros activos para un lector de pantalla y a la vista", () => {
    const html = render(filtered, "/tips?fundamento=recepcion&nivel=basico");

    const active = linkWith(html, "Recepción");
    expect(active).toContain('aria-current="true"');
    expect(active).toContain("bg-brand-lime");
    expect(linkWith(html, "Básico")).toContain('aria-current="true"');
    expect(linkWith(html, "Saque")).not.toContain("aria-current");
    expect(html.match(/aria-current="true"/g)).toHaveLength(2);
  });

  it("elegir un filtro conserva los demás y vuelve a la primera página", () => {
    const html = render(
      { query: { level: "basic", query: "mano", page: 3 }, latestTip: null },
      "/tips?nivel=basico&buscar=mano&pagina=3",
    );

    expect(linkWith(html, "Saque")).toContain(
      'href="/tips?fundamento=saque&amp;nivel=basico&amp;buscar=mano"',
    );
  });

  it("'Todos' quita su filtro y deja el otro", () => {
    const html = render(filtered, "/tips?fundamento=recepcion&nivel=basico");

    const [allFundamentals, allLevels] =
      html.match(/<a [^>]*aria-label="Todos[^"]*"[^>]*>/g) ?? [];

    expect(allFundamentals).toContain('href="/tips?nivel=basico"');
    expect(allLevels).toContain('href="/tips?fundamento=recepcion"');
  });

  it("sin filtros, 'Todos' es el activo en los dos grupos", () => {
    const html = render();

    const all = html.match(/<a [^>]*aria-label="Todos[^"]*"[^>]*>/g) ?? [];

    expect(all).toHaveLength(2);
    for (const link of all) expect(link).toContain('aria-current="true"');
  });

  it("en inglés los enlaces usan los nombres en inglés", () => {
    const html = render({}, "/en/tips");

    expect(linkWith(html, "Reception")).toContain(
      'href="/en/tips?skill=reception"',
    );
  });
});

describe("listado de tips: búsqueda", () => {
  it("es un formulario GET que conserva los filtros", () => {
    const html = render(
      {
        query: { fundamental: "serve", query: "<b>%_", page: 2 },
        latestTip: null,
      },
      "/tips?fundamento=saque",
    );

    expect(html).toMatch(
      /<form(?=[^>]*method="get")(?=[^>]*action="\/tips")[^>]*>/,
    );
    expect(html).toMatch(
      /<input[^>]*type="hidden"[^>]*name="fundamento"[^>]*value="saque"/,
    );
    expect(html).not.toContain('name="pagina"');
    expect(html).toMatch(
      /<input(?=[^>]*name="buscar")(?=[^>]*maxLength="100")(?=[^>]*value="&lt;b&gt;%_")[^>]*>/,
    );
  });

  it("en inglés el campo se llama como la dirección en inglés", () => {
    expect(render({}, "/en/tips")).toContain('name="search"');
  });
});

describe("listado de tips: paginación", () => {
  it("'Cargar más tips' es un enlace a la página siguiente con los filtros", () => {
    const html = render(
      {
        query: { level: "basic", query: "", page: 2 },
        latestTip: null,
        hasNextPage: true,
      },
      "/tips?nivel=basico&pagina=2",
    );

    expect(linkWith(html, "Cargar más tips")).toContain(
      'href="/tips?nivel=basico&amp;pagina=3"',
    );
  });

  it("la última página no ofrece cargar más", () => {
    expect(render({ hasNextPage: false })).not.toContain("Cargar más tips");
  });
});

describe("listado de tips: último video", () => {
  it("va arriba, con su frase, su enlace y carga con prioridad", () => {
    const html = render();
    const latest = linkWith(html, "El destacado");

    expect(html.indexOf("El destacado")).toBeLessThan(
      html.indexOf("Todos los tips"),
    );
    expect(latest).toContain("Último video");
    expect(latest).toContain("Recibe sin miedo");
    expect(latest).toContain('href="/tips/tip-9"');
    expect(latest).toMatch(/<img[^>]*fetchPriority="high"/);
    expect(latest).not.toContain('loading="lazy"');
  });

  it("no se pinta cuando no llega", () => {
    expect(render({ latestTip: null })).not.toContain("Último video");
  });
});

describe("listado de tips: aviso de resultados", () => {
  it.each([
    ["sin filtros", { query: "", page: 1 }],
    ["con filtros", { query: "mano", page: 1 }],
  ])("%s dice cuántos hay a un lector de pantalla", (_name, query) => {
    const html = render({ query, latestTip: null });

    expect(html).toMatch(/<p role="status"[^>]*>2 resultados<\/p>/);
  });
});

describe("listado de tips: vacíos", () => {
  it("sin resultados lo dice y ofrece quitar los filtros", () => {
    const html = render(
      {
        query: { query: "nada", page: 1 },
        total: 0,
        tips: [],
        latestTip: null,
      },
      "/tips?buscar=nada",
    );

    expect(html).toContain("No encontramos tips");
    expect(linkWith(html, "Quitar filtros")).toContain('href="/tips"');
  });

  it("sin tips publicados lo dice e invita a las redes", () => {
    const html = render({
      publishedTotal: 0,
      total: 0,
      tips: [],
      latestTip: null,
    });

    expect(html).toContain("Todavía no hay tips publicados.");
    expect(html).toContain('href="https://www.tiktok.com/@volleytip"');
    expect(html).toContain('href="https://www.instagram.com/volleytip/"');
    expect(html).not.toContain("<form");
  });
});

describe("listado de tips: meta y menú", () => {
  it.each(["/tips?nivel=basico", "/en/tips?level=basic"])(
    "en %s declara canónica y hreflang sin los filtros",
    (at) => {
      const html = renderInSite(
        <LanguageAlternates siteOrigin="https://volleytip.com" />,
        at,
      );

      const canonical = at.startsWith("/en") ? "/en/tips" : "/tips";
      expect(html).toContain(
        `<link rel="canonical" href="https://volleytip.com${canonical}"/>`,
      );
      expect(html).toContain('hrefLang="es" href="https://volleytip.com/tips"');
      expect(html).toContain(
        'hrefLang="en" href="https://volleytip.com/en/tips"',
      );
    },
  );

  it.each(["/tips", "/en/tips"])("en %s el menú marca Tips", (at) => {
    const html = renderInSite(<SiteHeader />, at);

    expect(html).toMatch(
      new RegExp(`<a[^>]*aria-current="page"[^>]*href="${at}"[^>]*>Tips</a>`),
    );
  });
});
