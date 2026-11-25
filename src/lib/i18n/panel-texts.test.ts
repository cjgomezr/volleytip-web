import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { panelEn } from "./messages/panel-en";
import { panelEs } from "./messages/panel-es";
import { checkCatalogs, findUnusedKeys, type CatalogSet } from "./text-guard";
import { findWrittenText } from "./written-text";

const PANEL_DIRECTORIES = [
  "src/components/panel",
  "src/routes/panel",
  "src/lib/admin",
];
const PANEL_FILES = [
  "src/components/panel-screen.tsx",
  "src/components/panel-sign-out.tsx",
];

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
      .flatMap((path) =>
        findWrittenText(readFileSync(path, "utf8")).map(
          (text) => `${path}: ${text}`,
        ),
      );

    expect(offenders).toEqual([]);
  });

  it.each([
    "<p>El modo está encendido</p>",
    "<p>No hay datos</p>",
    "<span>⚠ Mantenimiento activo</span>",
    "<p>Total (hoy)</p>",
    "<p>{'Resumen'}</p>",
    '<nav aria-label={"Secciones"} />',
    "<div title={`Resumen`} />",
    '<input placeholder="Buscar" />',
    "<p>{isOn ? 'Sí' : null}</p>",
  ])("detecta un texto escrito a mano: %s", (element) => {
    expect(findWrittenText(`const view = ${element};`)).toHaveLength(1);
  });

  it.each([
    "<p>{translate('panel.nav.more')}</p>",
    '<span aria-hidden="true">⌂ › ⚠</span>',
    '<img alt="" className="size-4" />',
    "<p aria-current={isOn ? 'page' : undefined}>{count}</p>",
  ])("deja pasar lo que no es texto: %s", (element) => {
    expect(findWrittenText(`const view = ${element};`)).toEqual([]);
  });
});
