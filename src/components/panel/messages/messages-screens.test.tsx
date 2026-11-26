import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { InboxView, MessageView } from "~/lib/admin/messages";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { InboxScreen } from "./inbox-screen";
import { MessageScreen } from "./message-screen";

const ID = "0b7c1f9e-3f0a-4c1e-9a7d-2f4b6c8d0e12";
const HOSTILE_BODY =
  '<script>alert(1)</script>\n<a href="https://x.test">x</a> https://y.test';

const INBOX: InboxView = {
  query: { reason: null, status: null, search: "", page: 1 },
  rows: [
    {
      id: ID,
      href: `/admin/mensajes/${ID}`,
      name: "Laura Restrepo",
      excerpt: "Hola",
      reason: "brands",
      status: "new",
      dateTime: "2026-11-26T15:30:00Z",
      date: "26/11/26, 10:30",
    },
  ],
  total: 1,
  page: 1,
  pageCount: 1,
  previousHref: null,
  nextHref: null,
};

const EMPTY: InboxView = { ...INBOX, rows: [], total: 0 };

const MESSAGE: MessageView = {
  id: ID,
  name: "Laura Restrepo",
  email: "laura@prueba.volleytip.test",
  reason: "order",
  status: "new",
  country: "Colombia",
  language: "Español",
  dateTime: "2026-11-26T15:30:00Z",
  date: "26 de noviembre de 2026, 10:30",
  fields: [
    {
      id: "orderNumber",
      labelKey: "panel.messages.field.orderNumber",
      value: "VT-1042",
    },
  ],
  body: HOSTILE_BODY,
  privacyVersion: "2026-11",
  whatsapp: { number: "+57 300", href: "https://wa.me/57300" },
  mailHref: "mailto:laura@prueba.volleytip.test?subject=x",
  answer: null,
  notice: null,
};

function render(screen: ReactElement, language: Language = "es"): string {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          {screen}
        </TranslationsProvider>
      ),
    },
  ]);
  const path = language === "es" ? "/admin/mensajes" : "/en/admin/messages";
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

describe("bandeja: lista", () => {
  it("pinta nombre, motivo, fecha y estado en una tabla con encabezados", () => {
    const html = render(<InboxScreen {...INBOX} />);

    for (const text of [
      "<table",
      "<th",
      "Laura Restrepo",
      "Marcas y colaboraciones",
      "26/11/26, 10:30",
      "Nuevo",
      `href="/admin/mensajes/${ID}"`,
    ]) {
      expect(html).toContain(text);
    }
  });

  it("pagina con enlaces", () => {
    const html = render(
      <InboxScreen
        {...INBOX}
        page={2}
        pageCount={3}
        previousHref="/admin/mensajes"
        nextHref="/admin/mensajes?pagina=3"
      />,
    );

    expect(html).toContain('href="/admin/mensajes?pagina=3"');
    expect(html).toContain("Página 2 de 3");
  });
});

describe("bandeja: filtros", () => {
  it("es un formulario GET con lo que dice la dirección", () => {
    const html = render(
      <InboxScreen
        {...INBOX}
        query={{ reason: "order", status: "new", search: "lau", page: 1 }}
      />,
    );

    const form = /<form[^>]*>/.exec(html)?.[0] ?? "";
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/admin/mensajes"');
    expect(html).toContain('value="lau"');
    expect(html).toMatch(/<option value="order" selected="">/);
    expect(html).toMatch(/<option value="new" selected="">/);
    expect(html).toContain('type="submit"');
  });

  it("sin resultados lo dice y ofrece quitar los filtros", () => {
    const html = render(
      <InboxScreen {...EMPTY} query={{ ...EMPTY.query, search: "nadie" }} />,
    );

    expect(html).toContain("Ningún mensaje coincide con los filtros.");
    expect(html).toMatch(
      /<a[^>]*href="\/admin\/mensajes"[^>]*>Quitar filtros</,
    );
    expect(html).not.toContain("<table");
  });

  it("vacía dice que todavía no hay mensajes, sin filtros que quitar", () => {
    const html = render(<InboxScreen {...EMPTY} />);

    expect(html).toContain("Todavía no hay mensajes.");
    expect(html).not.toContain("Quitar filtros");
  });
});

describe("bandeja: detalle", () => {
  it.each([
    ["es", ["Un pedido", "Número de pedido", "Política de privacidad"]],
    ["en", ["An order", "Order number", "Privacy policy"]],
  ] as const)("pinta todos los campos en %s", (language, labels) => {
    const html = render(<MessageScreen {...MESSAGE} />, language);

    for (const text of [
      ...labels,
      "Laura Restrepo",
      "laura@prueba.volleytip.test",
      "Colombia",
      "Español",
      "VT-1042",
      "26 de noviembre de 2026, 10:30",
      "2026-11",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("pinta el HTML y los enlaces del cuerpo como texto", () => {
    const html = render(<MessageScreen {...MESSAGE} />);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="https://x.test"');
    expect(html).not.toContain('href="https://y.test"');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;\n");
    expect(html).toContain("whitespace-pre-wrap");
  });

  it("ofrece responder por correo y escribir por WhatsApp", () => {
    const html = render(<MessageScreen {...MESSAGE} />);

    expect(html).toMatch(
      /<a[^>]*href="mailto:laura@prueba.volleytip.test\?subject=x"[^>]*>Responder por correo</,
    );
    expect(html).toContain('href="https://wa.me/57300"');
    expect(html).toContain("Escribir por WhatsApp");
  });

  it("sin número no pinta el botón de WhatsApp", () => {
    const html = render(<MessageScreen {...MESSAGE} whatsapp={null} />);

    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("WhatsApp");
  });

  it.each([
    ["new", ["responder", "archivar"]],
    ["answered", ["archivar"]],
    ["archived", ["reabrir"]],
  ] as const)(
    "en un mensaje %s solo ofrece %o, sin borrar ni editar",
    (status, verbs) => {
      const html = render(<MessageScreen {...MESSAGE} status={status} />);

      const actions = [...html.matchAll(/<form[^>]*action="([^"]+)"/g)].map(
        ([, action]) => action,
      );
      expect(actions).toEqual(
        verbs.map((verb) => `/admin/mensajes/${ID}/${verb}`),
      );
      expect(html).not.toMatch(/<(input|textarea|select)/);
    },
  );

  it("dice quién respondió y cuándo", () => {
    const html = render(
      <MessageScreen
        {...MESSAGE}
        status="answered"
        answer={{
          by: "Camilo",
          dateTime: "2026-11-27T15:00:00Z",
          date: "27 de noviembre de 2026, 10:00",
        }}
      />,
    );

    expect(html).toContain("Respondido por Camilo");
    expect(html).toContain("27 de noviembre de 2026, 10:00");
  });

  it.each([
    ["answered", "El mensaje quedó marcado como respondido."],
    ["archived", "El mensaje quedó archivado."],
    ["reopened", "El mensaje se volvió a abrir."],
    ["unchanged", "El mensaje ya había cambiado. Este es su estado actual."],
  ] as const)("avisa %s", (notice, text) => {
    const html = render(<MessageScreen {...MESSAGE} notice={notice} />);

    expect(html).toContain(text);
  });
});
