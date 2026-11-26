import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { AnnouncementBar } from "~/components/announcement-bar";
import { StatsStrip } from "~/components/stats-strip";
import { ADMIN_MODULES } from "~/lib/admin/modules";
import { buildPanelNavigation } from "~/lib/admin/navigation";
import type { SiteTextsView } from "~/lib/admin/site-texts";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import {
  SiteTextsScreen,
  type SiteTextsScreenProps,
} from "./site-texts-screen";

const EMPTY_PAIR = { es: "", en: "" };

const VIEW: SiteTextsView = {
  bar: {
    messages: [
      { es: "Nuevo tip", en: "New tip" },
      { es: "Solo en español", en: "" },
    ],
    invalidValue: null,
  },
  stats: [
    {
      id: "instagram",
      value: { es: "116K", en: "116K" },
      label: { es: "seguidores", en: "followers" },
    },
    { id: "tiktok", value: EMPTY_PAIR, label: EMPTY_PAIR },
  ],
  limits: {
    maxMessages: 3,
    maxMessageLength: 80,
    maxStatValueLength: 12,
    maxStatLabelLength: 60,
  },
};

function render(
  props: Partial<SiteTextsScreenProps> = {},
  language: Language = "es",
): string {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          <SiteTextsScreen {...VIEW} {...props} />
        </TranslationsProvider>
      ),
    },
  ]);
  const path = language === "es" ? "/admin/textos" : "/en/admin/site-texts";
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

function inputTags(html: string, name: string): string[] {
  return [...html.matchAll(/<input[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => tag.includes(`name="${name}"`));
}

function buttonTag(html: string, label: string): string {
  const tags = [...html.matchAll(/<button[^>]*>/g)].map(([tag]) => tag);
  const found = tags.find((tag) => tag.includes(`aria-label="${label}"`));
  if (found === undefined) throw new Error(`No está el botón "${label}"`);
  return found;
}

/** El texto al que apunta `aria-describedby` de un campo. */
function describedText(html: string, input: string): string {
  const ids = /aria-describedby="([^"]*)"/.exec(input)?.[1]?.split(" ") ?? [];
  return ids
    .map((id) => {
      const found = new RegExp(`<p id="${id}"[^>]*>(.*?)</p>`).exec(html);
      return found?.[1] ?? "";
    })
    .join(" ");
}

const ENGLISH_WARNING = "saldrá en español";

describe("textos: pantalla", () => {
  it("muestra los mensajes y las cifras con sus valores", () => {
    const html = render();

    expect(inputTags(html, "es")).toHaveLength(2);
    expect(inputTags(html, "es")[0]).toContain('value="Nuevo tip"');
    expect(inputTags(html, "en")[0]).toContain('value="New tip"');
    expect(inputTags(html, "stats.instagram.value:es")[0]).toContain(
      'value="116K"',
    );
    expect(inputTags(html, "stats.instagram.label:en")[0]).toContain(
      'value="followers"',
    );
    expect(inputTags(html, "stats.tiktok.value:es")).toHaveLength(1);
  });

  it("envía cada formulario a su propia dirección", () => {
    expect(render()).toContain('action="/admin/textos/barra"');
    expect(render()).toContain('action="/admin/textos/cifras"');
    expect(render({}, "en")).toContain(
      'action="/en/admin/site-texts/announcements"',
    );
  });

  it("ofrece subir, bajar y quitar cada mensaje, sin salirse de la lista", () => {
    const html = render();

    expect(buttonTag(html, "Subir el mensaje 1")).toContain("disabled");
    expect(buttonTag(html, "Bajar el mensaje 1")).not.toContain("disabled");
    expect(buttonTag(html, "Bajar el mensaje 2")).toContain("disabled");
    expect(buttonTag(html, "Quitar el mensaje 2")).not.toContain("disabled");
    expect(html).toContain("Agregar mensaje");
  });

  it("con el máximo de mensajes no deja agregar otro", () => {
    const html = render({
      bar: {
        messages: [1, 2, 3].map((n) => ({ es: `${n}`, en: `${n}` })),
        invalidValue: null,
      },
    });

    expect(html).toMatch(/<button[^>]*disabled[^>]*>Agregar mensaje/);
  });

  it("sin mensajes lo explica y deja guardar", () => {
    const html = render({ bar: { messages: [], invalidValue: null } });

    expect(html).toContain("la barra no se muestra");
    expect(html).toContain("Guardar barra");
  });

  it("avisa junto al campo que sin inglés saldrá en español", () => {
    const html = render();
    const [translated, missing] = inputTags(html, "en");

    expect(describedText(html, missing ?? "")).toContain(ENGLISH_WARNING);
    expect(describedText(html, translated ?? "")).not.toContain(
      ENGLISH_WARNING,
    );
  });

  it("avisa también si el inglés solo tiene caracteres invisibles", () => {
    const html = render({
      bar: {
        messages: [{ es: "Hola", en: "\u200B " }],
        invalidValue: null,
      },
    });
    const [english] = inputTags(html, "en");

    expect(describedText(html, english ?? "")).toContain(ENGLISH_WARNING);
  });

  it("marca el error junto al campo y conserva lo escrito", () => {
    const html = render({
      barOutcome: {
        status: "invalid",
        values: [
          { es: "", en: "Only English" },
          { es: "Corto", en: "x".repeat(81) },
        ],
        fieldErrors: { "0.es": "required", "1.en": "tooLong" },
        formError: null,
      },
    });
    const [first] = inputTags(html, "es");
    const [kept, long] = inputTags(html, "en");

    expect(first).toContain('aria-invalid="true"');
    expect(describedText(html, first ?? "")).toContain(
      "Escribe el texto en español.",
    );
    expect(kept).toContain('value="Only English"');
    expect(long).toContain('aria-invalid="true"');
    expect(html).toContain("Máximo 80 caracteres.");
    expect(html).toMatch(/role="alert"[^>]*>[^<]*No se guardó/);
  });

  it("dice cuántos mensajes caben cuando llegan de más", () => {
    const values = [1, 2, 3, 4].map((n) => ({ es: `${n}`, en: "" }));

    const html = render({
      barOutcome: {
        status: "invalid",
        values,
        fieldErrors: {},
        formError: "tooMany",
      },
    });

    // Dentro de la alerta: si no, un lector de pantalla no lo anuncia. No hay
    // nada marcado, así que el resumen tampoco manda a revisarlo.
    expect(html).toMatch(
      /<p[^>]*role="alert"[^>]*>No se guardó\.(?:(?!<\/p>).)*La barra admite máximo/,
    );
    expect(html).not.toContain("Revisa lo marcado");

    expect(inputTags(html, "es")).toHaveLength(4);
    expect(html).toContain("La barra admite máximo 3 mensajes.");
  });

  it("marca el error de una cifra junto a su campo", () => {
    const html = render({
      statsOutcome: {
        status: "invalid",
        values: { "stats.instagram.value:es": "demasiado largo" },
        fieldErrors: { "stats.instagram.value:es": "tooLong" },
        formError: null,
      },
    });
    const [field] = inputTags(html, "stats.instagram.value:es");

    expect(field).toContain('aria-invalid="true"');
    expect(field).toContain('value="demasiado largo"');
    expect(html).toContain("Máximo 12 caracteres.");
  });

  it("dice que las cifras llegaron incompletas", () => {
    const html = render({
      statsOutcome: {
        status: "invalid",
        values: {},
        fieldErrors: {},
        formError: "malformed",
      },
    });

    expect(html).toContain("El envío llegó incompleto.");
  });

  it("el formulario de la barra dice cuántos mensajes manda", () => {
    expect(inputTags(render(), "messageCount")[0]).toContain('value="2"');
  });

  it.each([
    ["saved", "Cambios guardados."],
    ["unchanged", "No había cambios que guardar."],
  ] as const)(
    "anuncia el resultado %s en una región de estado",
    (status, text) => {
      const html = render({ barOutcome: { status } });

      expect(html).toMatch(
        new RegExp(
          `<div role="status"[^>]*><p[^>]*>(<[^>]*>[^<]*</[^>]*>)?${text}`,
        ),
      );
    },
  );

  it("las regiones de estado existen antes de guardar", () => {
    expect(render().match(/<div role="status"/g)).toHaveLength(2);
  });

  it("muestra un valor inválido de la base como inválido", () => {
    const html = render({
      bar: { messages: [], invalidValue: '"<roto>"' },
    });

    expect(html).toContain("no tiene la forma esperada");
    expect(html).toContain("&lt;roto&gt;");
    expect(html).toContain("Guardar barra");
  });

  it("sale en inglés bajo /en/", () => {
    const html = render({}, "en");

    expect(html).toContain("Announcement bar");
    expect(html).toContain("Home figures");
    expect(html).not.toContain("Barra de anuncios");
  });
});

describe("textos: HTML en el sitio", () => {
  const HTML_TEXT = "<script>alert(1)</script>";
  const ESCAPED = "&lt;script&gt;alert(1)&lt;/script&gt;";

  it("la barra lo pinta como texto", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar messages={[HTML_TEXT]} />,
    );

    expect(html).toContain(ESCAPED);
    expect(html).not.toContain("<script>");
  });

  it("las cifras lo pintan como texto", () => {
    const html = renderToStaticMarkup(
      <TranslationsProvider language="es" messages={getMessages("es")}>
        <StatsStrip
          pageLanguage="es"
          label="Cifras"
          stats={[
            {
              id: "instagram",
              value: "1K",
              valueLanguage: "es",
              label: HTML_TEXT,
              labelLanguage: "es",
            },
          ]}
        />
      </TranslationsProvider>,
    );

    expect(html).not.toContain("<script>");
  });
});

describe("textos: módulo", () => {
  it.each([
    ["es", "/admin/textos", "/admin/mas"],
    ["en", "/en/admin/site-texts", "/en/admin/more"],
  ] as const)(
    "en %s aparece en el menú lateral y en 'Más'",
    (language, href, morePath) => {
      const navigation = buildPanelNavigation(ADMIN_MODULES, {
        role: "admin",
        language,
        pathname: morePath,
        pendingCounts: {},
        morePath,
      });

      for (const list of [navigation.sidebar, navigation.more]) {
        expect(list).toContainEqual(
          expect.objectContaining({
            href,
            labelKey: "panel.module.siteTexts",
          }),
        );
      }
    },
  );
});
