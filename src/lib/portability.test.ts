import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const ENV_MODULE = "lib/env.server.ts";
const SOURCE_FILE = /\.(ts|tsx)$/;
// Los tests no se despliegan y alguno necesita preparar el entorno de un
// proceso hijo. La regla vigila el código que sí corre en el servidor.
const TEST_FILE = /\.test\.(ts|tsx)$/;
const SERVER_MODULE = /\.server\.(ts|tsx)$/;

const PROCESS_ENV = /process\s*(\.|\[\s*["'])env/;
// DEV, PROD, MODE y SSR los define Vite y no son configuración del despliegue.
const IMPORT_META_ENV = /import\.meta\.env\.(?!DEV\b|PROD\b|MODE\b|SSR\b)/;
const RAILWAY_VARIABLE = /RAILWAY_/;
// Cubre `from "..."`, `import("...")` e `import "..."`, con o sin extensión.
const SERVICE_CLIENT_IMPORT = /["'][^"']*service-client\.server(\.tsx?)?["']/;

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

function listSourceFiles(): SourceFile[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.split(path.sep).join("/"))
    .filter((entry) => SOURCE_FILE.test(entry) && !TEST_FILE.test(entry))
    .map((relativePath) => ({
      relativePath,
      content: readFileSync(path.join(SOURCE_ROOT, relativePath), "utf8"),
    }));
}

function findFilesMatching(
  pattern: RegExp,
  files: readonly SourceFile[],
): string[] {
  return files
    .filter(({ content }) => pattern.test(content))
    .map(({ relativePath }) => relativePath);
}

function asSourceFile(relativePath: string, content: string): SourceFile[] {
  return [{ relativePath, content }];
}

describe("portabilidad", () => {
  it("encuentra los archivos de src/", () => {
    expect(listSourceFiles().length).toBeGreaterThan(0);
  });

  it("solo env.server.ts lee process.env", () => {
    expect(findFilesMatching(PROCESS_ENV, listSourceFiles())).toEqual([
      ENV_MODULE,
    ]);
  });

  it("ningún archivo lee configuración por import.meta.env", () => {
    expect(findFilesMatching(IMPORT_META_ENV, listSourceFiles())).toEqual([]);
  });

  it("ningún archivo nombra una variable propia de Railway", () => {
    expect(findFilesMatching(RAILWAY_VARIABLE, listSourceFiles())).toEqual([]);
  });

  it.each([
    ["process.env.SECRETO", PROCESS_ENV],
    ['process.env["SECRETO"]', PROCESS_ENV],
    ["const { SECRETO } = process.env;", PROCESS_ENV],
    ['process["env"].SECRETO', PROCESS_ENV],
    ["import.meta.env.VITE_SECRETO", IMPORT_META_ENV],
    ["const { RAILWAY_PUBLIC_DOMAIN } = variables;", RAILWAY_VARIABLE],
  ])("la búsqueda detecta %j", (snippet, pattern) => {
    expect(findFilesMatching(pattern, asSourceFile("a.ts", snippet))).toEqual([
      "a.ts",
    ]);
  });

  it("la búsqueda deja pasar import.meta.env.DEV", () => {
    const files = asSourceFile("a.ts", "if (import.meta.env.DEV) {}");

    expect(findFilesMatching(IMPORT_META_ENV, files)).toEqual([]);
  });
});

describe("cliente de Supabase con llave de servicio", () => {
  it("solo lo importan módulos de servidor", () => {
    const importers = findFilesMatching(
      SERVICE_CLIENT_IMPORT,
      listSourceFiles(),
    ).filter((relativePath) => !SERVER_MODULE.test(relativePath));

    expect(importers).toEqual([]);
  });

  it.each([
    'import { createServiceSupabaseClient } from "~/lib/supabase/service-client.server";',
    'import { createServiceSupabaseClient } from "./service-client.server.ts";',
    'const client = await import("~/lib/supabase/service-client.server");',
    'export * from "../lib/supabase/service-client.server";',
  ])("la búsqueda detecta %j desde una ruta", (snippet) => {
    const files = asSourceFile("routes/pedidos.tsx", snippet);

    expect(findFilesMatching(SERVICE_CLIENT_IMPORT, files)).toEqual([
      "routes/pedidos.tsx",
    ]);
  });
});
