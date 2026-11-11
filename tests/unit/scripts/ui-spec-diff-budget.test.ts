import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const UI_SPEC_PATH = path.join(REPO_ROOT, "tests/ui.spec.ts");

/**
 * El presupuesto de diferencia de una captura tiene que ser ABSOLUTO.
 *
 * Un presupuesto por ratio (`maxDiffPixelRatio`) crece con el alto de la
 * página: cuanto más larga, más píxeles caben debajo del mismo porcentaje. Un
 * cambio en un componente pequeño se reparte entre miles de píxeles y pasa
 * desapercibido, y el punto ciego crece solo según crece la app. Medido en el
 * proyecto de origen (issue #77): una regresión real de 1756 píxeles cabía
 * holgadamente bajo el ratio que había.
 *
 * `maxDiffPixels` no crece con la página, y por eso es el que vale.
 */
describe("presupuesto de diferencia visual", () => {
  it("ninguna captura fullPage lleva maxDiffPixelRatio", () => {
    const source = readFileSync(UI_SPEC_PATH, "utf8");
    // Sin los comentarios: el que explica esta misma regla tiene que poder
    // nombrar lo que prohíbe. Lo que se vigila es el código.
    const code = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    expect(code).toMatch(/fullPage: true/);
    expect(code).not.toMatch(/maxDiffPixelRatio/);
  });
});
