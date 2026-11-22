import { describe, expect, it } from "vitest";

import {
  MissingSpanishTranslationError,
  resolveTranslatedFields,
} from "./translation-fallback";

interface TipFields {
  readonly title: string;
  readonly keys: readonly string[];
  readonly views: number;
}

const SPANISH: TipFields = { title: "Título", keys: ["uno", "dos"], views: 3 };
const ENGLISH: TipFields = { title: "Title", keys: ["one", "two"], views: 5 };

describe("respaldo en español", () => {
  it("usa el inglés en todos los campos cuando están traducidos", () => {
    const result = resolveTranslatedFields<TipFields>({
      requestedLanguage: "en",
      translations: { es: SPANISH, en: ENGLISH },
    });

    expect(result.fields).toEqual(ENGLISH);
  });

  it("usa el español solo en el campo que falta en inglés (AC-003)", () => {
    const result = resolveTranslatedFields<TipFields>({
      requestedLanguage: "en",
      translations: { es: SPANISH, en: { title: "Title", keys: ["one"] } },
    });

    expect(result.fields.title).toBe("Title");
    expect(result.fields.keys).toEqual(["one"]);
    expect(result.fields.views).toBe(3);
  });

  it("usa el español en todos los campos cuando no hay inglés", () => {
    const result = resolveTranslatedFields<TipFields>({
      requestedLanguage: "en",
      translations: { es: SPANISH },
    });

    expect(result.fields).toEqual(SPANISH);
  });

  it.each(["", "   ", "\n\t"])("cuenta como ausente el texto %j", (blank) => {
    const result = resolveTranslatedFields<TipFields>({
      requestedLanguage: "en",
      translations: { es: SPANISH, en: { ...ENGLISH, title: blank } },
    });

    expect(result.fields.title).toBe("Título");
  });

  it("cuenta como ausente una lista vacía y usa la del español", () => {
    const result = resolveTranslatedFields<TipFields>({
      requestedLanguage: "en",
      translations: { es: SPANISH, en: { ...ENGLISH, keys: [] } },
    });

    expect(result.fields.keys).toEqual(["uno", "dos"]);
  });

  it("lanza un error claro cuando falta el español", () => {
    const resolveWithoutSpanish = (): unknown =>
      resolveTranslatedFields<TipFields>({
        requestedLanguage: "en",
        translations: { en: ENGLISH },
      });

    expect(resolveWithoutSpanish).toThrow(MissingSpanishTranslationError);
    expect(resolveWithoutSpanish).toThrow(/español es obligatorio/);
  });

  it("dice de qué idioma salió cada campo", () => {
    const result = resolveTranslatedFields<TipFields>({
      requestedLanguage: "en",
      translations: { es: SPANISH, en: { title: "Title", keys: [] } },
    });

    expect(result.languages).toEqual({ title: "en", keys: "es", views: "es" });
  });

  it("pidiendo español devuelve el español sin mirar el inglés", () => {
    const result = resolveTranslatedFields<TipFields>({
      requestedLanguage: "es",
      translations: { es: SPANISH, en: ENGLISH },
    });

    expect(result.fields).toEqual(SPANISH);
    expect(result.languages.title).toBe("es");
  });
});

describe("respaldo en español: tipos", () => {
  it("conserva el tipo de cada campo", () => {
    const { fields } = resolveTranslatedFields<TipFields>({
      requestedLanguage: "en",
      translations: { es: SPANISH, en: ENGLISH },
    });

    const title: string = fields.title;
    const keys: readonly string[] = fields.keys;
    const views: number = fields.views;
    expect([title, keys, views]).toEqual(["Title", ["one", "two"], 5]);
  });
});
