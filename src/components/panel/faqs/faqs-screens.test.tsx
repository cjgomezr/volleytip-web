import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { buildSampleFaqs, type SampleFaqState } from "~/lib/admin/sample-faqs";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { FaqEditorScreen } from "./faq-editor-screen";
import { FaqListScreen } from "./faq-list-screen";

// El primer pintado, que es lo que ve quien no tiene JavaScript. Las pestañas
// y el foco se prueban en `tests/admin-faqs.spec.ts`.

function buildScreen(state: SampleFaqState): ReactElement {
  const sample = buildSampleFaqs(state, "es");
  return sample.screen === "list" ? (
    <FaqListScreen {...sample.view} />
  ) : (
    <FaqEditorScreen {...sample.view} initialOutcome={sample.outcome} />
  );
}

function render(state: SampleFaqState): string {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider language="es" messages={getMessages("es")}>
          {buildScreen(state)}
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/admin/preguntas"]} />);
}

function readRows(html: string): string[] {
  return html.split(/(?=<li data-faq-row)/).slice(1);
}

function buttonTag(html: string, label: string): string {
  const tags = [...html.matchAll(/<button[^>]*>/g)].map(([tag]) => tag);
  const found = tags.find((tag) => tag.includes(`aria-label="${label}"`));
  if (found === undefined) throw new Error(`No está el botón "${label}"`);
  return found;
}

function fieldTag(html: string, name: string): string {
  const found = [...html.matchAll(/<(?:input|textarea)[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => tag.includes(`name="${name}"`));
  if (found === undefined) throw new Error(`No está el campo "${name}"`);
  return found;
}

const IS_DISABLED = / disabled=""/;
const FIRST_ID = "11111111-1111-4111-8111-111111111111";

describe("preguntas: la pantalla de la lista", () => {
  it("pinta cada pregunta con su estado, en orden", () => {
    const statuses = readRows(render("lista")).map(
      (row) => /data-faq-status="(\w+)"/.exec(row)?.[1],
    );

    expect(statuses).toEqual(["published", "published", "draft", "retired"]);
  });

  it("marca qué idiomas tiene cada una", () => {
    const [first, second] = readRows(render("lista"));

    expect(first).toContain("español: con traducción");
    expect(first).toContain("inglés: sin traducción");
    expect(second).toContain("inglés: con traducción");
  });

  it("avisa solo en las publicadas a las que les falta inglés (AC-065)", () => {
    const warned = readRows(render("lista")).map((row) =>
      row.includes("Falta inglés: en /en/ saldrá en español."),
    );

    expect(warned).toEqual([true, false, false, false]);
  });

  it("deshabilita Subir en la primera y Bajar en la última", () => {
    const html = render("lista");

    expect(buttonTag(html, "Subir la pregunta 1")).toMatch(IS_DISABLED);
    expect(buttonTag(html, "Bajar la pregunta 1")).not.toMatch(IS_DISABLED);
    expect(buttonTag(html, "Subir la pregunta 4")).not.toMatch(IS_DISABLED);
    expect(buttonTag(html, "Bajar la pregunta 4")).toMatch(IS_DISABLED);
  });

  it("ofrece retirar las publicadas y publicar las demás, nunca borrar", () => {
    const html = render("lista");

    expect(buttonTag(html, "Retirar la pregunta 1")).toContain("submit");
    expect(buttonTag(html, "Publicar la pregunta 3")).toContain("submit");
    expect(buttonTag(html, "Publicar la pregunta 4")).toContain("submit");
    expect(html).not.toMatch(/borrar|eliminar/i);
  });

  it("cada botón envía un formulario a su ruta, aun sin JavaScript", () => {
    const [first] = readRows(render("lista"));

    const forms = [...(first ?? "").matchAll(/<form[^>]*>/g)].map(
      ([tag]) => tag,
    );
    expect(forms.every((tag) => tag.includes('method="post"'))).toBe(true);
    for (const verb of ["mover", "retirar"]) {
      expect(forms.join()).toContain(
        `action="/admin/preguntas/${FIRST_ID}/${verb}"`,
      );
    }
    expect(first).toContain('name="direction" value="down"');
  });

  it("vacía: lo dice y ofrece crear la primera", () => {
    const html = render("vacia");

    expect(html).toContain("Todavía no hay preguntas.");
    expect(html).toMatch(
      /<a[^>]*href="\/admin\/preguntas\/nueva"[^>]*>Crear la primera pregunta/,
    );
  });
});

describe("preguntas: la pantalla del editor", () => {
  it("sin JavaScript trae los campos de todos los idiomas", () => {
    const html = render("editor");

    for (const name of ["question:es", "answer:es"]) {
      expect(fieldTag(html, name)).toBeDefined();
    }
    expect(html).toContain("Pregunta (English)");
    expect(html).toContain("Respuesta (English)");
    expect(html).not.toContain('role="tab"');
  });

  it("con errores marca los campos y conserva lo escrito", () => {
    const html = render("errores");

    expect(fieldTag(html, "question:es")).toContain('aria-invalid="true"');
    expect(fieldTag(html, "question:es")).toContain("Y también a las islas.");
    expect(fieldTag(html, "answer:en")).toContain('aria-invalid="true"');
    expect(fieldTag(html, "answer:es")).not.toContain("aria-invalid");
    expect(html).toContain("Te pasaste del límite de 200 caracteres.");
    expect(html).toContain("No se guardó. Revisa lo marcado.");
  });

  it("enlaza a cada respuesta su límite y su error", () => {
    const html = render("errores");
    const described = /aria-describedby="([^"]*)"/.exec(
      fieldTag(html, "answer:en"),
    )?.[1];

    expect(described?.split(" ")).toHaveLength(2);
  });

  it("manda con cada campo el texto que se pintó", () => {
    const html = render("editor");

    expect(fieldTag(html, "base:question:es")).toContain('type="hidden"');
    expect(fieldTag(html, "base:answer:en")).toContain('value=""');
  });

  it("no limita lo que se escribe: el servidor es quien rechaza", () => {
    expect(render("editor")).not.toMatch(/maxlength/i);
  });
});
