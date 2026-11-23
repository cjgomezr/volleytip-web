import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { AppAvailability } from "~/lib/app-availability.server";
import type { WaitlistOutcome } from "~/lib/forms/waitlist-form.server";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { AppPage } from "./app-page";

const PROTECTION = {
  siteKey: "1x00000000000000000000AA",
  timestamp: "1795000000000.firma-de-prueba",
};
const APP_STORE = "https://apps.apple.com/co/app/volleytip/id123";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.vt";
const WAITLIST: AppAvailability = { state: "waitlist" };

function render({
  at = "/app",
  availability = WAITLIST,
  outcome,
}: {
  at?: string;
  availability?: AppAvailability;
  outcome?: WaitlistOutcome;
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
          <AppPage
            availability={availability}
            protection={PROTECTION}
            outcome={outcome}
          />
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={[at]} />);
}

describe("app: página", () => {
  it("muestra las ocho funciones con dos etiquetas Pronto", () => {
    const html = render();

    expect(html.match(/<h3[ >]/g)).toHaveLength(8);
    expect(html).toContain("Biblioteca de ejercicios");
    expect(html).toContain("Fixtures de torneos");
    expect(html.match(/>Pronto</g)).toHaveLength(2);
  });

  it("en lista de espera muestra la etiqueta Próximamente y el formulario con Colombia elegida", () => {
    const html = render();

    expect(html).toContain("Próximamente");
    expect(html).toContain('type="email"');
    expect(html).toMatch(/<option value="CO" selected="">Colombia<\/option>/);
    expect(html).not.toContain("apps.apple.com");
  });

  it("el formulario dice que al enviar se acepta la política, con su enlace", () => {
    const html = render();

    expect(html).toContain("Al enviar aceptas la ");
    expect(html).toContain('href="/privacidad"');
  });

  it("no pinta la frase del contador de inscritos", () => {
    expect(render()).not.toMatch(/personas ya están|people are already/);
  });

  it("muestra el bloque Una sola cuenta, 100% gratis y cuatro preguntas que se abren sin JavaScript", () => {
    const html = render();

    expect(html).toContain("Una sola cuenta");
    expect(html).toContain("100% gratis");
    expect(html.match(/<details[ >]/g)).toHaveLength(4);
    expect(html.match(/<summary[ >]/g)).toHaveLength(4);
  });

  it("en inglés los textos salen de la traducción y el enlace conserva el idioma", () => {
    const html = render({ at: "/en/app" });

    expect(html).toContain("Coming soon");
    expect(html).toContain("Drill library");
    expect(html).toContain('href="/en/privacy"');
    expect(html).toMatch(/<option value="ES">Spain<\/option>/);
  });

  it("con un envío aceptado pinta la confirmación en una región de estado y quita el formulario", () => {
    const html = render({ outcome: { status: "joined" } });

    expect(html).toMatch(/<div role="status"[^>]*>.*Te avisamos el día/);
    expect(html).not.toContain('type="email"');
  });

  it("con un correo inválido pinta el error junto al campo y conserva lo escrito", () => {
    const html = render({
      outcome: {
        status: "invalid",
        fieldErrors: { email: "waitlist.error.email" },
        values: { email: "ana@", country: "MX" },
      },
    });

    expect(html).toContain("Escribe un correo válido.");
    expect(html).toContain('value="ana@"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<option value="MX" selected="">México<\/option>/);
  });

  it("con un envío rechazado avisa con un mensaje que se anuncia", () => {
    const html = render({
      outcome: { status: "rejected", reason: "rate_limited" },
    });

    expect(html).toMatch(/role="alert"[^>]*>[^<]*Hiciste muchos intentos/);
  });

  it("disponible con las dos direcciones reemplaza el formulario por los botones y quita Próximamente", () => {
    const html = render({
      availability: {
        state: "available",
        appStoreUrl: APP_STORE,
        playStoreUrl: PLAY_STORE,
      },
    });

    expect(html).toContain(`href="${APP_STORE}"`);
    expect(html).toContain(`href="${PLAY_STORE}"`);
    expect(html).not.toContain("Próximamente");
    expect(html).not.toContain('type="email"');
  });

  it("disponible con una sola dirección pinta solo ese botón", () => {
    const html = render({
      availability: {
        state: "available",
        appStoreUrl: null,
        playStoreUrl: PLAY_STORE,
      },
    });

    expect(html).toContain(`href="${PLAY_STORE}"`);
    expect(html).not.toContain("apps.apple.com");
  });
});
