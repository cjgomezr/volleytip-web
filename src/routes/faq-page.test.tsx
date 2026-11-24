import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { Faq } from "~/lib/faqs.server";
import { getMessages } from "~/lib/i18n/messages.server";
import type { PageDeclaration } from "~/lib/i18n/page-path";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { FaqPage } from "./faq-page";

const CONTACT: PageDeclaration = {
  id: "contact",
  file: "routes/contact.tsx",
  path: { es: "contacto", en: "contact" },
};

function buildFaq(overrides: Partial<Faq> = {}): Faq {
  return {
    id: "1",
    question: "¿Cuánto cuesta?",
    questionLanguage: "es",
    answer: "Nada.",
    answerLanguage: "es",
    ...overrides,
  };
}

function render({
  language = "es",
  faqs = [buildFaq()],
  pages,
}: {
  language?: "es" | "en";
  faqs?: readonly Faq[];
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
          <FaqPage faqs={faqs} language={language} pages={pages} />
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(
    <Stub
      initialEntries={[language === "en" ? "/en/faq" : "/preguntas-frecuentes"]}
    />,
  );
}

describe("preguntas frecuentes: página", () => {
  it("tiene un solo h1", () => {
    expect(render().match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("pinta cada pregunta en un details con su summary, en orden", () => {
    const html = render({
      faqs: [
        buildFaq({ id: "1", question: "Primera" }),
        buildFaq({ id: "2", question: "Segunda" }),
      ],
    });

    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).toMatch(/<summary[^>]*>[^]*Primera[^]*<\/summary>/);
    expect(html.indexOf("Primera")).toBeLessThan(html.indexOf("Segunda"));
  });

  it("respeta los saltos de línea de la respuesta", () => {
    const html = render({ faqs: [buildFaq({ answer: "Uno\nDos" })] });

    expect(html).toMatch(/<p[^>]*class="[^"]*whitespace-pre-line[^"]*"/);
    expect(html).toContain("Uno\nDos");
  });

  it("pinta las etiquetas HTML de la respuesta como texto", () => {
    const html = render({
      faqs: [buildFaq({ answer: "<script>alert(1)</script>" })],
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("marca el idioma de un campo que cayó al español en la página en inglés", () => {
    const html = render({
      language: "en",
      faqs: [buildFaq({ question: "Question", questionLanguage: "en" })],
    });

    expect(html).toMatch(/<p[^>]*lang="es"[^>]*>Nada\./);
    expect(html).not.toMatch(/<span[^>]*lang="en"/);
  });

  it("dice que no hay preguntas cuando la lista está vacía", () => {
    const html = render({ faqs: [] });

    expect(html).toContain("Todavía no hay preguntas publicadas");
    expect(html).not.toContain("<details");
  });

  it("da el titular en cada idioma", () => {
    expect(render()).toMatch(/<h1[^>]*>Preguntas frecuentes/);
    expect(render({ language: "en" })).toMatch(
      /<h1[^>]*>Frequently asked questions/,
    );
  });

  it("no enlaza a Contacto mientras esa página no exista", () => {
    expect(render({ faqs: [], pages: [] })).not.toContain("contacto");
  });

  it("enlaza a Contacto cuando la página existe", () => {
    expect(render({ faqs: [], pages: [CONTACT] })).toContain(
      'href="/contacto"',
    );
    expect(render({ faqs: [], pages: [CONTACT], language: "en" })).toContain(
      'href="/en/contact"',
    );
  });
});
