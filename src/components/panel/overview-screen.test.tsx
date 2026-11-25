import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { OverviewView } from "~/lib/admin/overview";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { OverviewScreen } from "./overview-screen";

const MESSAGES_CARD = {
  id: "new-messages",
  labelKey: "panel.overview.card.newMessages",
  value: { status: "ok", value: "0" },
} as const;
const APP_CARD = {
  id: "app-waitlist",
  labelKey: "panel.overview.card.appWaitlist",
  value: { status: "ok", value: "0" },
} as const;
const CAMP_CARD = {
  id: "camp-notify",
  labelKey: "panel.overview.card.campNotify",
  value: { status: "ok", value: "0" },
} as const;

const EMPTY: OverviewView = {
  cards: [MESSAGES_CARD, APP_CARD, CAMP_CARD],
  activity: { status: "ok", value: [] },
  rejections: { status: "ok", value: { total: "0", forms: [] } },
};

const WITH_DATA: OverviewView = {
  cards: [
    {
      ...MESSAGES_CARD,
      value: { status: "ok", value: "3" },
      href: "/admin/mensajes?estado=new",
    },
    { ...APP_CARD, value: { status: "failed" } },
    CAMP_CARD,
  ],
  activity: {
    status: "ok",
    value: [
      {
        id: "1",
        action: "faq.update",
        actorName: "Andrés Gómez",
        dateTime: "2026-11-26T19:30:00Z",
        date: "26/11/26, 2:30 p. m.",
      },
      {
        id: "2",
        action: "order.refund",
        actorName: null,
        dateTime: "2026-11-25T19:30:00Z",
        date: "25/11/26, 2:30 p. m.",
      },
    ],
  },
  rejections: {
    status: "ok",
    value: {
      total: "9",
      forms: [
        {
          form: "contact",
          labelKey: "panel.overview.form.contact",
          total: "8",
          reasons: [
            {
              reason: "too_fast",
              labelKey: "panel.overview.reason.tooFast",
              count: "8",
            },
          ],
        },
        {
          form: "nuevo_formulario",
          total: "1",
          reasons: [
            {
              reason: "honeypot",
              labelKey: "panel.overview.reason.honeypot",
              count: "1",
            },
          ],
        },
      ],
    },
  },
};

function render(overview: OverviewView, language: Language = "es"): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          <OverviewScreen greetingName="Andrés Gómez" overview={overview} />
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub />);
}

describe("resumen: pantalla", () => {
  it("saluda por el nombre y titula el documento Resumen", () => {
    const html = render(EMPTY);

    expect(html).toMatch(/<h1[^>]*>Hola, Andrés Gómez<\/h1>/);
    expect(html).toContain("<title>Resumen</title>");
  });

  it("muestra los cuatro datos", () => {
    const html = render(EMPTY);

    for (const text of [
      "Mensajes sin responder",
      "Lista de espera de la app",
      "Inscritos en «Avísame»",
      "Actividad reciente",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("vacío: cada tarjeta en cero y los avisos de que no hay nada", () => {
    const html = render(EMPTY);

    expect(html.match(/data-overview-value="true">0</g)).toHaveLength(3);
    expect(html).toContain("Todavía no hay actividad.");
    expect(html).toContain("No se descartó ningún envío");
    expect(html).not.toContain("<a ");
  });

  it("lista fecha, quién y acción, y sin actor dice Sistema", () => {
    const html = render(WITH_DATA);

    expect(html).toContain('dateTime="2026-11-26T19:30:00Z"');
    expect(html).toContain("26/11/26, 2:30 p. m.");
    expect(html).toContain("faq.update");
    expect(html).toContain("Andrés Gómez");
    expect(html).toContain("Sistema");
    expect(html).not.toContain("Todavía no hay actividad.");
  });

  it("solo es enlace la tarjeta que tiene a dónde ir", () => {
    const html = render(WITH_DATA);

    // El otro enlace es "Reintentar": esta vista trae una tarjeta con fallo.
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="/admin/mensajes?estado=new"');
  });

  it("la tarjeta que falló lo dice y las demás se pintan", () => {
    const html = render(WITH_DATA);

    expect(html.match(/No se pudo cargar este dato\./g)).toHaveLength(1);
    expect(html.match(/data-overview-value="true"/g)).toHaveLength(2);
  });

  it("la actividad y los descartes dicen que fallaron", () => {
    const html = render({
      ...EMPTY,
      activity: { status: "failed" },
      rejections: { status: "failed" },
    });

    expect(html).toContain("No se pudo cargar la actividad.");
    expect(html).toContain("No se pudieron cargar los envíos descartados.");
    expect(html).not.toContain("Todavía no hay actividad.");
  });

  it("los avisos de fallo salen en el rojo de error, no en el tono de vacío", () => {
    const html = render({
      ...EMPTY,
      activity: { status: "failed" },
      rejections: { status: "failed" },
    });

    const notices = [...html.matchAll(/<p class="([^"]*)">No se pud/g)].map(
      ([, classes]) => classes,
    );

    expect(notices).toHaveLength(2);
    for (const classes of notices) {
      expect(classes).toContain("text-brand-red-deep");
      expect(classes).not.toContain("text-ink-subtle");
    }
  });

  it.each([
    ["una tarjeta", WITH_DATA],
    ["la actividad", { ...EMPTY, activity: { status: "failed" } as const }],
    ["los descartes", { ...EMPTY, rejections: { status: "failed" } as const }],
  ])("si falla %s, ofrece reintentar en la misma pantalla", (_what, view) => {
    expect(render(view)).toMatch(/<a [^>]*href="\/"[^>]*>Reintentar<\/a>/);
  });

  it("sin fallos no ofrece reintentar", () => {
    expect(render(EMPTY)).not.toContain("Reintentar");
  });

  it("muestra los descartes por formulario y motivo", () => {
    const html = render(WITH_DATA);

    expect(html).toContain("Contacto");
    expect(html).toContain("Envío demasiado rápido");
    expect(html).toContain("nuevo_formulario");
    expect(html).toContain("Campo trampa lleno");
  });

  it("toma sus textos de las traducciones en inglés", () => {
    const html = render(WITH_DATA, "en");

    for (const text of [
      "Hi, Andrés Gómez",
      "<title>Overview</title>",
      "Unanswered messages",
      "App waitlist",
      "Recent activity",
      "System",
      "Discarded submissions",
      "Submitted too fast",
      "Could not load this number.",
    ]) {
      expect(html).toContain(text);
    }
  });
});
