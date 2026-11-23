import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { CampNotifyOutcome } from "~/lib/camp-notify";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { CampNotify } from "./camp-notify";

const PROTECTION = {
  siteKey: "1x00000000000000000000AA",
  timestamp: "1.firma",
};

function renderNotify(
  language: "es" | "en",
  serverOutcome?: CampNotifyOutcome,
): string {
  const Page = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          <CampNotify protection={PROTECTION} serverOutcome={serverOutcome} />
        </TranslationsProvider>
      ),
    },
  ]);
  const path = language === "en" ? "/en/" : "/";
  return renderToStaticMarkup(<Page initialEntries={[path]} />);
}

describe("avísame: componente", () => {
  it("da una etiqueta a cada campo", () => {
    const html = renderNotify("es");

    expect(html).toMatch(/<label[^>]*>Correo/);
    expect(html).toMatch(/<label[^>]*>Ciudad \(opcional\)/);
  });

  it("dice que al enviar se acepta la privacidad, con enlace a ella", () => {
    expect(renderNotify("es")).toMatch(
      /Al enviar aceptas la <a[^>]+href="\/privacidad"[^>]*>política de privacidad<\/a>/,
    );
    expect(renderNotify("en")).toMatch(/<a[^>]+href="\/en\/privacy"/);
  });

  it("saca sus textos de las traducciones del idioma", () => {
    expect(renderNotify("en")).toContain("Tell me about the next camp");
  });

  it("incluye la protección del formulario", () => {
    expect(renderNotify("es")).toContain('value="1.firma"');
  });

  it("reemplaza el formulario por la confirmación dentro de una región anunciada", () => {
    const html = renderNotify("es", { status: "joined" });

    expect(html).toMatch(/role="status"[^>]*>.*te avisaremos/);
    expect(html).not.toContain("<form");
  });

  it("conserva lo escrito y pinta el error junto al campo", () => {
    const html = renderNotify("es", {
      status: "invalid",
      fieldErrors: { email: "Escribe un correo válido" },
      values: { email: "no-es-correo", city: "Cali" },
    });

    expect(html).toContain('value="no-es-correo"');
    expect(html).toContain('value="Cali"');
    expect(html).toContain("Escribe un correo válido");
  });

  it("muestra el mensaje cuando el envío fue rechazado", () => {
    expect(
      renderNotify("es", { status: "rejected", message: "Muchos intentos" }),
    ).toContain("Muchos intentos");
  });
});
