import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { en } from "./messages/en";
import { es } from "./messages/es";
import {
  checkCatalogs,
  findUnusedKeys,
  type Catalog,
  type CatalogSet,
} from "./text-guard";

const GOOD_ES: Catalog = {
  "a.title": "Hola",
  "a.greeting": "Hola {name}",
  "a.seats": { one: "{count} cupo", other: "{count} cupos" },
};

const GOOD_EN: Catalog = {
  "a.title": "Hello",
  "a.greeting": "Hello {name}",
  "a.seats": { one: "{count} seat", other: "{count} seats" },
};

const GOOD: CatalogSet = { es: GOOD_ES, en: GOOD_EN };

function withoutTitle(catalog: CatalogSet[string]): CatalogSet[string] {
  return Object.fromEntries(
    Object.entries(catalog).filter(([key]) => key !== "a.title"),
  );
}

describe("guardia de textos: claves", () => {
  it("no encuentra nada en un juego correcto", () => {
    expect(checkCatalogs(GOOD)).toEqual([]);
  });

  it("nombra la clave y el idioma cuando falta en inglés", () => {
    const en = withoutTitle(GOOD_EN);
    expect(checkCatalogs({ ...GOOD, en })).toEqual([
      expect.stringContaining('"a.title"'),
    ]);
    expect(checkCatalogs({ ...GOOD, en })[0]).toContain("en");
  });

  it("falla igual cuando la clave falta en español", () => {
    const es = withoutTitle(GOOD_ES);
    const [issue] = checkCatalogs({ ...GOOD, es });
    expect(issue).toContain('"a.title"');
    expect(issue).toContain("es");
  });

  it("falla con un texto vacío o de solo espacios", () => {
    expect(
      checkCatalogs({ ...GOOD, en: { ...GOOD.en, "a.title": "" } }),
    ).toHaveLength(1);
    expect(
      checkCatalogs({ ...GOOD, en: { ...GOOD.en, "a.title": "   " } }),
    ).toHaveLength(1);
  });

  it("nombra la variable cuando difiere entre idiomas", () => {
    const [issue] = checkCatalogs({
      ...GOOD,
      en: { ...GOOD.en, "a.greeting": "Hello {user}" },
    });
    expect(issue).toContain('"a.greeting"');
    expect(issue).toMatch(/name|user/);
  });

  it("falla cuando a un plural le falta una forma que su idioma necesita", () => {
    const [issue] = checkCatalogs({
      ...GOOD,
      es: { ...GOOD.es, "a.seats": { one: "{count} cupo" } as never },
    });
    expect(issue).toContain("other");
  });

  it("falla cuando una clave es texto en un idioma y plural en otro", () => {
    expect(
      checkCatalogs({ ...GOOD, en: { ...GOOD.en, "a.seats": "seats" } }),
    ).not.toEqual([]);
  });
});

describe("guardia de textos: claves sin uso", () => {
  it("nombra una clave que ningún archivo usa", () => {
    expect(findUnusedKeys(["a.title", "a.old"], [`t("a.title")`])).toEqual([
      expect.stringContaining('"a.old"'),
    ]);
  });

  it("no marca una clave que sí se usa", () => {
    expect(findUnusedKeys(["a.title"], [`messages["a.title"]`])).toEqual([]);
  });
});

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((path) => join(directory, path))
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .filter((path) => !/\.test\.tsx?$/.test(path))
    .filter((path) => !path.includes(join("i18n", "messages")))
    .filter((path) => !path.endsWith("database.types.ts"));
}

describe("guardia de textos: el repo", () => {
  it("los archivos de traducción reales pasan todas las comprobaciones", () => {
    expect(checkCatalogs({ es, en } as CatalogSet)).toEqual([]);
  });

  it("todas las claves reales se usan en algún archivo de src", () => {
    const sources = listSourceFiles("src").map((path) =>
      readFileSync(path, "utf8"),
    );
    expect(findUnusedKeys(Object.keys(es), sources)).toEqual([]);
  });
});
