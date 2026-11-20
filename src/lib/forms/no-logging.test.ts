import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FORMS_DIRECTORY = fileURLToPath(new URL("./", import.meta.url));
const TEST_FILE = /\.test\.ts$/;
const CONSOLE_CALL = /\bconsole\s*\./;

function listModules(): string[] {
  return readdirSync(FORMS_DIRECTORY).filter(
    (file) => file.endsWith(".ts") && !TEST_FILE.test(file),
  );
}

// Estas piezas manejan la IP del visitante. Si ninguna escribe en la
// consola, ninguna puede dejar la IP en un log.
describe("protección de formularios: registros", () => {
  it("encuentra los módulos", () => {
    expect(listModules().length).toBeGreaterThan(0);
  });

  it.each(listModules())("%s no escribe en la consola", (file) => {
    const source = readFileSync(path.join(FORMS_DIRECTORY, file), "utf8");

    expect(source).not.toMatch(CONSOLE_CALL);
  });
});
