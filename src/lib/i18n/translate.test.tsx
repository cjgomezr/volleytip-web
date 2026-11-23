import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMessages, getTranslate } from "./messages.server";
import { createTranslate, type Messages } from "./translate";

// Mensajes de prueba con variables y plurales; el tipo de claves real solo
// conoce las de `es.ts`, así que se leen sin pasar por él.
const SEATS = {
  other: "{count} cupos",
  one: "{count} cupo",
  zero: "Sin cupos",
};
const testMessages = {
  "home.title": "Hola {name}",
  "home.description": SEATS,
} as unknown as Messages;

type LooseTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function translateOf(
  messages: Messages,
  language: "es" | "en",
): LooseTranslate {
  return createTranslate(messages, language) as LooseTranslate;
}

describe("textos", () => {
  it("entrega el texto de cada idioma para una clave que existe", () => {
    expect(getTranslate("es")("home.eyebrow")).toBe(
      "Videos cortos · educativos · gratis",
    );
    expect(getTranslate("en")("home.eyebrow")).toBe(
      "Short videos · educational · free",
    );
  });

  it("incluye las variables que se piden", () => {
    const t = translateOf(testMessages, "es");
    expect(t("home.title", { name: "Ana" })).toBe("Hola Ana");
  });

  it("no vuelve a expandir un valor que trae llaves", () => {
    const t = translateOf(testMessages, "es");

    expect(t("home.title", { name: "{name} {otra}" })).toBe(
      "Hola {name} {otra}",
    );
  });

  it("falla con un error claro si falta el valor de una variable", () => {
    const t = translateOf(testMessages, "es");

    expect(() => t("home.title", {})).toThrow(/"name"/);
  });

  it("deja un valor con script o ampersand como texto literal al pintarlo", () => {
    const t = translateOf(testMessages, "es");
    const text = t("home.title", { name: "<script>x</script> & Cía" });
    const html = renderToStaticMarkup(<p>{text}</p>);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt; &amp; Cía");
  });
});

describe("textos: plurales", () => {
  it.each(["es", "en"] as const)(
    "usa la forma de cada cantidad en %s",
    (language) => {
      const t = translateOf(testMessages, language);
      expect(t("home.description", { count: 0 })).toBe("Sin cupos");
      expect(t("home.description", { count: 1 })).toBe("1 cupo");
      expect(t("home.description", { count: 3 })).toBe("3 cupos");
    },
  );

  it("no falla con una cantidad negativa o decimal", () => {
    const t = translateOf(testMessages, "en");
    expect(t("home.description", { count: 1.5 })).toBe("1.5 cupos");
    expect(t("home.description", { count: -3 })).toBe("-3 cupos");
  });

  it("pide un count numérico", () => {
    const t = translateOf(testMessages, "es");
    expect(() => t("home.description", {})).toThrow(/count/);
  });
});

describe("textos: sin petición", () => {
  it("el servidor obtiene un texto pasando solo el idioma", () => {
    expect(getTranslate("en")("error.serverTitle")).toBe("Timeout called");
  });

  it("el navegador solo recibe los textos del idioma pedido", () => {
    const sent = JSON.stringify(getMessages("en"));
    expect(sent).not.toContain("Videos cortos");
  });
});
