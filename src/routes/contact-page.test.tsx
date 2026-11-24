import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { ContactReasonId } from "~/lib/contact-reasons";
import type { Faq } from "~/lib/faqs.server";
import type { ContactOutcome } from "~/lib/forms/contact-form.server";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { ContactPage } from "./contact-page";

const PROTECTION = {
  siteKey: "1x00000000000000000000AA",
  timestamp: "1795000000000.firma-de-prueba",
};

function buildFaq(id: string): Faq {
  return {
    id,
    question: `Pregunta ${id}`,
    questionLanguage: "es",
    answer: "Respuesta",
    answerLanguage: "es",
  };
}

function render({
  at = "/contacto",
  reason = "other",
  faqs = [],
  outcome,
}: {
  at?: string;
  reason?: ContactReasonId;
  faqs?: readonly Faq[];
  outcome?: ContactOutcome;
} = {}): string {
  const language = at.startsWith("/en") ? "en" : "es";
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          <ContactPage
            reason={reason}
            language={language}
            faqs={faqs}
            protection={PROTECTION}
            outcome={outcome}
          />
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={[at]} />);
}

describe("contacto: página", () => {
  it("muestra 'Hablemos' y la promesa de respuesta en menos de 24 horas", () => {
    const html = render();

    expect(html).toMatch(/<h1[^>]*>Hablemos<\/h1>/);
    expect(html).toContain("menos de 24 horas");
  });

  it("sale en inglés en /en/contact", () => {
    const html = render({ at: "/en/contact" });

    expect(html).toMatch(/<h1[^>]*>Let&#x27;s talk<\/h1>/);
    expect(html).toContain("within 24 hours");
  });
});

describe("contacto: motivos", () => {
  it("ofrece los cinco motivos como enlaces con el parámetro de la dirección", () => {
    const html = render();

    expect(html).toContain('href="/contacto?motivo=pedido"');
    expect(html).toContain('href="/contacto?motivo=camps"');
    expect(html).toContain('href="/contacto?motivo=marcas"');
    expect(html).toContain('href="/contacto?motivo=tip"');
    expect(html).toContain('href="/contacto?motivo=otro"');
  });

  it("usa el parámetro en inglés en /en/contact", () => {
    const html = render({ at: "/en/contact" });

    expect(html).toContain('href="/en/contact?motivo=order"');
    expect(html).toContain('href="/en/contact?motivo=brands"');
  });

  it("marca solo el motivo elegido", () => {
    const html = render({ reason: "camps" });

    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true"[^>]*>Camps y VBall Tour</);
  });

  it("'Un pedido' pide el número de pedido y no la marca", () => {
    const html = render({ reason: "order" });

    expect(html).toContain('name="orderNumber"');
    expect(html).not.toContain('name="brand"');
  });

  it("'Marcas y colaboraciones' pide la marca o club y no el pedido", () => {
    const html = render({ reason: "brands" });

    expect(html).toContain('name="brand"');
    expect(html).not.toContain('name="orderNumber"');
  });

  it.each(["camps", "tip", "other"] as const)(
    "%s no agrega campos propios",
    (reason) => {
      const html = render({ reason });

      expect(html).not.toContain('name="orderNumber"');
      expect(html).not.toContain('name="brand"');
    },
  );

  it("cualquier motivo pide nombre, correo, país y mensaje, con Colombia elegida", () => {
    const html = render({ reason: "tip" });

    expect(html).toContain('name="name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="message"');
    expect(html).toMatch(/<option value="CO" selected="">Colombia<\/option>/);
  });

  it("lleva el motivo en un campo oculto con el valor de la dirección", () => {
    const html = render({ reason: "brands", at: "/en/contact" });

    expect(html).toMatch(/name="reason"[^>]*value="brands"/);
  });
});

describe("contacto: envío", () => {
  it("con el envío aceptado muestra la confirmación en una región de estado y quita el formulario", () => {
    const html = render({ outcome: { status: "sent" } });

    expect(html).toMatch(/<div role="status">.*Mensaje enviado/);
    expect(html).not.toContain("<form");
  });

  it("antes de enviar la región de estado existe y está vacía", () => {
    const html = render();

    expect(html).toContain('<div role="status"></div>');
  });

  it("marca cada error junto a su campo y conserva lo escrito", () => {
    const html = render({
      reason: "order",
      outcome: {
        status: "invalid",
        fieldErrors: {
          email: "contact.error.email",
          orderNumber: "contact.error.orderNumberRequired",
        },
        values: { name: "Ana", email: "mal", message: "Mi pedido" },
      },
    });

    expect(html).toContain("Escribe un correo válido.");
    expect(html).toContain("Escribe el número de tu pedido.");
    expect(html).toContain('value="Ana"');
    expect(html).toContain('value="mal"');
    expect(html).toContain("Mi pedido");
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(2);
  });

  it("al rechazar por el límite ofrece WhatsApp y el correo", () => {
    const html = render({
      outcome: { status: "rejected", reason: "rate_limited" },
    });

    expect(html).toContain("+57 314 648 6275");
    expect(html).toContain("team@volleytip.com");
    expect(html).toContain('role="alert"');
  });

  it("el pie del formulario enlaza la política de privacidad", () => {
    const html = render();

    expect(html).toContain("Al enviar aceptas nuestra");
    expect(html).toContain('href="/privacidad"');
  });
});

describe("contacto: columna lateral", () => {
  it("muestra WhatsApp y el correo con sus enlaces", () => {
    const html = render();

    expect(html).toContain('href="https://wa.me/573146486275"');
    expect(html).toContain("+57 314 648 6275");
    expect(html).toContain('href="mailto:team@volleytip.com"');
  });

  it("muestra las preguntas frecuentes con enlace a la página de preguntas", () => {
    const html = render({ faqs: [buildFaq("1"), buildFaq("2")] });

    expect(html).toContain("Pregunta 1");
    expect(html).toContain("Pregunta 2");
    expect(html).toContain('href="/preguntas-frecuentes"');
  });

  it("sin preguntas no pinta el bloque", () => {
    const html = render({ faqs: [] });

    expect(html).not.toContain("¿Tienes una pregunta rápida?");
    expect(html).not.toContain('href="/preguntas-frecuentes"');
  });
});
