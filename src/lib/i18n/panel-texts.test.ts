import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { panelEn } from "./messages/panel-en";
import { panelEs } from "./messages/panel-es";
import { checkCatalogs, findUnusedKeys, type CatalogSet } from "./text-guard";

const PANEL_DIRECTORIES = [
  "src/components/panel",
  "src/routes/panel",
  "src/lib/admin",
];
const PANEL_FILES = [
  "src/components/panel-screen.tsx",
  "src/components/panel-sign-out.tsx",
];

// Texto escrito entre etiquetas, o en un atributo que se lee o se oye.
const WRITTEN_TEXT =
  />\s*\p{L}{3,}[^<>{}()=;]*<\/|(aria-label|alt|title|placeholder)="[^"]*\p{L}/u;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((path) => join(directory, path))
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));
}

describe("textos del panel", () => {
  const files = [...PANEL_DIRECTORIES.flatMap(listSourceFiles), ...PANEL_FILES];

  it("cada texto del panel existe en español y en inglés", () => {
    expect(checkCatalogs({ es: panelEs, en: panelEn } as CatalogSet)).toEqual(
      [],
    );
  });

  it("todas las claves del panel se usan en un archivo del panel", () => {
    const sources = files.map((path) => readFileSync(path, "utf8"));

    expect(findUnusedKeys(Object.keys(panelEs), sources)).toEqual([]);
  });

  it("ningún componente del panel escribe un texto a mano", () => {
    const offenders = files
      .filter((path) => path.endsWith(".tsx"))
      .filter((path) => WRITTEN_TEXT.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });
});
