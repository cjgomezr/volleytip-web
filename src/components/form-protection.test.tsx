import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "~/lib/forms/field-names";
import { HONEYPOT_FIELD as SERVER_HONEYPOT_FIELD } from "~/lib/forms/honeypot.server";

import { FormProtection } from "./form-protection";

const SITE_KEY = "1x00000000000000000000AA";
const TIMESTAMP = "1795000000000.firma-de-prueba";

/** El componente lee el estado de la navegación, así que necesita un router
 * de datos alrededor, como el de la app. */
function renderProtection(): string {
  const Page = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <FormProtection siteKey={SITE_KEY} timestamp={TIMESTAMP} />
      ),
    },
  ]);
  return renderToStaticMarkup(<Page />);
}

function findInput(html: string, name: string): string {
  const input = new RegExp(`<input [^>]*name="${name}"[^>]*>`).exec(html);
  if (input === null) {
    throw new Error(`No hay un <input name="${name}"> en el marcado`);
  }
  return input[0];
}

describe("componente de protección", () => {
  it("pinta la marca de tiempo firmada en un campo oculto", () => {
    const input = findInput(renderProtection(), TIMESTAMP_FIELD);

    expect(input).toContain('type="hidden"');
    expect(input).toContain(`value="${TIMESTAMP}"`);
  });

  it("pinta el contenedor del widget de Turnstile con la llave de sitio", () => {
    expect(renderProtection()).toMatch(
      new RegExp(`<div[^>]* data-sitekey="${SITE_KEY}"`),
    );
  });

  it("el contenedor del widget reserva su espacio antes de cargar", () => {
    expect(renderProtection()).toMatch(
      /<div[^>]*class="[^"]*min-h-\[65px\][^"]*"[^>]* data-sitekey=/,
    );
  });

  it("pinta el campo trampa con el nombre que lee el servidor", () => {
    expect(HONEYPOT_FIELD).toBe(SERVER_HONEYPOT_FIELD);
    expect(findInput(renderProtection(), HONEYPOT_FIELD)).toBeDefined();
  });

  it("el campo trampa no recibe foco ni autocompletado", () => {
    const input = findInput(renderProtection(), HONEYPOT_FIELD);

    expect(input).toContain('tabindex="-1"');
    expect(input).toContain('autoComplete="off"');
    expect(input).toContain('type="text"');
  });

  it("los lectores de pantalla ignoran el campo trampa", () => {
    const html = renderProtection();

    expect(html).toMatch(
      new RegExp(
        `<div[^>]* aria-hidden="true"[^>]*><input [^>]*name="${HONEYPOT_FIELD}"`,
      ),
    );
  });

  it("el campo trampa queda fuera de la vista, no con display none", () => {
    const wrapper = /<div[^>]* aria-hidden="true"[^>]*>/.exec(
      renderProtection(),
    )?.[0];

    expect(wrapper).toContain("absolute");
    expect(wrapper).toContain("-left-[9999px]");
    expect(wrapper?.split(/[\s"]/)).not.toContain("hidden");
  });

  it("no contiene ningún texto propio", () => {
    expect(renderProtection().replaceAll(/<[^>]+>/g, "")).toBe("");
  });
});
