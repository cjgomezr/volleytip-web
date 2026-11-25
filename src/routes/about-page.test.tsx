import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { PageDeclaration } from "~/lib/i18n/page-path";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import type { SiteStat } from "~/lib/site-stats.server";

import { AboutPage } from "./about-page";

const CONTACT: PageDeclaration = {
  id: "contact",
  file: "routes/contact.tsx",
  path: { es: "contacto", en: "contact" },
};
const STATS: readonly SiteStat[] = [
  {
    id: "tiktok",
    value: "530K",
    valueLanguage: "es",
    label: "seguidores en TikTok",
    labelLanguage: "es",
  },
];

/** El texto del h1, sin las etiquetas que lo parten en líneas. */
function readHeading(html: string): string {
  const [, inner = ""] = /<h1[^>]*>(.*?)<\/h1>/s.exec(html) ?? [];
  return inner
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function render({
  language = "es",
  stats = STATS,
  pages,
}: {
  language?: "es" | "en";
  stats?: readonly SiteStat[];
  pages?: readonly PageDeclaration[];
} = {}): string {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          <AboutPage
            stats={stats}
            language={language}
            cdnHost="imagenes-de-prueba.b-cdn.net"
            pages={pages}
          />
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(
    <Stub initialEntries={[language === "en" ? "/en/about" : "/nosotros"]} />,
  );
}

describe("nosotros: página", () => {
  it("tiene un solo h1 con el titular y encabezados en orden", () => {
    const html = render();

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(readHeading(html)).toBe("El voley es para todos");
    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((m) => m[1]);
    expect(levels[0]).toBe("1");
    levels.forEach((level, index) => {
      if (index > 0) {
        expect(Number(level) - Number(levels[index - 1])).toBeLessThanOrEqual(
          1,
        );
      }
    });
  });

  it("muestra tres pasos numerados", () => {
    const html = render();

    expect(html).toContain("Cómo lo hacemos");
    expect(html).toContain(">01<");
    expect(html).toContain(">02<");
    expect(html).toContain(">03<");
    expect(html).not.toContain(">04<");
  });

  it("muestra cuatro momentos en orden, de 2019 a hoy", () => {
    const html = render();

    const order = ["2019", "Los inicios", "Las pausas", "Hoy"].map((moment) =>
      html.indexOf(`>${moment}<`),
    );
    expect(order.every((position) => position > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("parte el titular después de la primera línea, como el diseño", () => {
    expect(render()).toMatch(/<h1[^>]*><span class="block">El voley<\/span>/);
    expect(render({ language: "en" })).toMatch(
      /<h1[^>]*><span class="block">Volleyball<\/span>/,
    );
  });

  it("de cada fundador muestra nombre y cargo, sin párrafo", () => {
    const html = render();
    const founders = html.slice(
      html.indexOf("Los fundadores"),
      html.indexOf("¡Sigamos jugando!"),
    );

    expect(founders).toContain("Comunicador audiovisual");
    expect(founders).not.toContain("creatividad");
    expect(founders).not.toContain("democratizar");
  });

  it("muestra a los dos fundadores con foto y alt", () => {
    const html = render();

    expect(html).toContain("Andrés Piza");
    expect(html).toContain("Camilo Gómez");
    expect(html).toContain("Comunicador audiovisual");
    expect(html).toContain("Ingeniero y desarrollador");
    expect(html).toMatch(/<img[^>]+alt="Andrés Piza, cofundador[^"]*"/);
    expect(html).toMatch(/<img[^>]+alt="Camilo Gómez, cofundador[^"]*"/);
    expect(html).toContain("sitio/piza.webp");
    expect(html).toContain("sitio/gomez.webp");
  });

  it("pinta los personajes sin párrafo de relleno ni texto entre corchetes", () => {
    const html = render();

    expect(html).toContain("¡Sigamos jugando!");
    expect(html).toContain("sitio/personajes.jpg");
    expect(html).not.toMatch(/>[^<]*\[[^<]*</);
    expect(html).not.toContain("Quiénes son los personajes");
  });

  it("no pinta el botón Media kit", () => {
    expect(render()).not.toMatch(/media kit/i);
    expect(render({ language: "en" })).not.toMatch(/media kit/i);
  });

  it("la foto del héroe carga de inmediato y las demás de forma perezosa", () => {
    const images = [...render().matchAll(/<img[^>]*>/g)].map((m) => m[0]);

    expect(images[0]).toContain('loading="eager"');
    expect(images.slice(1).length).toBeGreaterThanOrEqual(3);
    for (const image of images.slice(1)) {
      expect(image).toContain('loading="lazy"');
    }
    for (const image of images) {
      expect(image).toMatch(/alt="[^"]+"/);
      expect(image).toMatch(/width="\d+"/);
      expect(image).toMatch(/height="\d+"/);
    }
  });

  it("pinta las cifras que recibe y omite el bloque sin ninguna", () => {
    expect(render()).toContain("530K");
    expect(render({ stats: [] })).not.toContain("Comunidad en números");
  });

  it("sale en inglés con los textos de las traducciones", () => {
    const html = render({ language: "en" });

    expect(readHeading(html)).toBe("Volleyball is for everyone");
    expect(html).toContain("The founders");
    expect(html).toContain("Let&#x27;s keep playing!");
    expect(html).not.toContain("Cómo lo hacemos");
  });
});

describe("nosotros: trabajemos juntos", () => {
  it("enlaza a Contacto con el motivo de marcas en el idioma de la página", () => {
    const spanish = render({ pages: [CONTACT] });
    const english = render({ language: "en", pages: [CONTACT] });

    expect(spanish).toContain('href="/contacto?motivo=marcas"');
    expect(english).toContain('href="/en/contact?motivo=marcas"');
  });

  it("no pinta el botón cuando Contacto no está en el mapa de páginas", () => {
    const html = render({ pages: [] });

    expect(html).toContain("Trabajemos juntos");
    expect(html).not.toContain("Contáctanos");
  });
});
