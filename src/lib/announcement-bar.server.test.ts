import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_BAR_KEY,
  ANNOUNCEMENT_BAR_SETTING,
  MAX_ANNOUNCEMENT_MESSAGES,
  pickAnnouncementMessages,
} from "./announcement-bar.server";

describe("ajuste de la barra de anuncios", () => {
  const isValid = ANNOUNCEMENT_BAR_SETTING.isValid;

  it("acepta una lista de mensajes con su texto por idioma", () => {
    expect(isValid([{ text: { es: "Hola", en: "Hi" } }])).toBe(true);
    expect(isValid([{ text: { es: "Hola" } }])).toBe(true);
  });

  it("acepta la lista vacía y el ajuste no existente cae a lista vacía", () => {
    expect(isValid([])).toBe(true);
    expect(ANNOUNCEMENT_BAR_SETTING.fallback).toEqual([]);
    expect(ANNOUNCEMENT_BAR_SETTING.key).toBe(ANNOUNCEMENT_BAR_KEY);
  });

  it.each([
    ["no es lista", { text: { es: "Hola" } }],
    ["un mensaje sin texto", [{}]],
    ["sin español", [{ text: { en: "Hi" } }]],
    ["texto que no es cadena", [{ text: { es: 3 } }]],
    ["traducción que no es cadena", [{ text: { es: "Hola", en: 3 } }]],
    ["nulo", null],
  ])("rechaza una forma inválida: %s", (_case, value) => {
    expect(isValid(value)).toBe(false);
  });

  it("se queda con los tres primeros mensajes", () => {
    const messages = Array.from({ length: 5 }, (_, index) => ({
      text: { es: `m${index}` },
    }));

    expect(pickAnnouncementMessages(messages, "es")).toEqual([
      "m0",
      "m1",
      "m2",
    ]);
    expect(MAX_ANNOUNCEMENT_MESSAGES).toBe(3);
  });
});

describe("mensajes de la barra por idioma", () => {
  const messages = [{ text: { es: "Hola", en: "Hi" } }];

  it("usa el español en la página en español", () => {
    expect(pickAnnouncementMessages(messages, "es")).toEqual(["Hola"]);
  });

  it("usa la traducción en inglés cuando existe", () => {
    expect(pickAnnouncementMessages(messages, "en")).toEqual(["Hi"]);
  });

  it("cae al español cuando no hay inglés", () => {
    expect(pickAnnouncementMessages([{ text: { es: "Hola" } }], "en")).toEqual([
      "Hola",
    ]);
  });

  it("cuenta como ausente el inglés vacío o de solo espacios", () => {
    expect(
      pickAnnouncementMessages([{ text: { es: "Hola", en: "   " } }], "en"),
    ).toEqual(["Hola"]);
    expect(
      pickAnnouncementMessages([{ text: { es: "Hola", en: "" } }], "en"),
    ).toEqual(["Hola"]);
  });
});
