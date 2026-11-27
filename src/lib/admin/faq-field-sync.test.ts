import { describe, expect, it } from "vitest";

import { syncFaqField } from "./faq-field-sync";

describe("syncFaqField", () => {
  it("trae lo guardado a un campo que la persona no tocó", () => {
    const next = syncFaqField("question", {
      visible: "¿Hacen envíos?",
      base: "¿Hacen envíos?",
      stored: "¿Envían fuera del país?",
      sent: "¿Hacen envíos?",
    });

    expect(next).toEqual({
      visible: "¿Envían fuera del país?",
      base: "¿Envían fuera del país?",
    });
  });

  it("un campo que solo difiere en lo que el servidor limpia no está tocado", () => {
    const next = syncFaqField("question", {
      visible: "  Hola\tmundo ",
      base: "Hola mundo",
      stored: "Lo que guardó otra persona",
      sent: "  Hola\tmundo ",
    });

    expect(next).toEqual({
      visible: "Lo que guardó otra persona",
      base: "Lo que guardó otra persona",
    });
  });

  it("los saltos de línea del navegador no cuentan como un cambio en la respuesta", () => {
    const next = syncFaqField("answer", {
      visible: "Uno\r\nDos",
      base: "Uno\nDos",
      stored: "Tres",
      sent: undefined,
    });

    expect(next).toEqual({ visible: "Tres", base: "Tres" });
  });

  it("no reescribe un campo que ya muestra lo guardado, aunque le sobre un espacio", () => {
    const next = syncFaqField("question", {
      visible: "Hola mundo ",
      base: "Hola mundo",
      stored: "Hola mundo",
      sent: undefined,
    });

    expect(next).toEqual({ visible: "Hola mundo ", base: "Hola mundo" });
  });

  it("si se guardó lo que esta persona envió, avanza la base y deja lo que siguió escribiendo", () => {
    const next = syncFaqField("question", {
      visible: "Texto nuevo y algo más",
      base: "Texto viejo",
      stored: "Texto nuevo",
      sent: "Texto nuevo",
    });

    expect(next).toEqual({
      visible: "Texto nuevo y algo más",
      base: "Texto nuevo",
    });
  });

  it("lo enviado se compara ya limpio, como lo guarda el servidor", () => {
    const next = syncFaqField("question", {
      visible: "Hola\tmundo",
      base: "Texto viejo",
      stored: "Hola mundo",
      sent: "Hola\tmundo",
    });

    expect(next).toEqual({ visible: "Hola\tmundo", base: "Hola mundo" });
  });

  it("si el campo está tocado y lo guardado es de otra persona, conserva la base vieja", () => {
    const next = syncFaqField("question", {
      visible: "Lo mío, escrito durante el envío",
      base: "Texto viejo",
      stored: "Lo de otra persona",
      sent: "Texto viejo",
    });

    expect(next).toEqual({
      visible: "Lo mío, escrito durante el envío",
      base: "Texto viejo",
    });
  });

  it("sin un envío propio, un campo tocado conserva la base vieja", () => {
    const next = syncFaqField("answer", {
      visible: "Lo mío",
      base: "Texto viejo",
      stored: "Lo de otra persona",
      sent: undefined,
    });

    expect(next).toEqual({ visible: "Lo mío", base: "Texto viejo" });
  });
});
