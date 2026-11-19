/**
 * Genera los tipos de TypeScript de la base de datos desde la base local de
 * Supabase y los deja en src/lib/database.types.ts.
 *
 *   npm run db:types        regenera el archivo
 *   npm run db:types:check  falla si el archivo quedó viejo (lo corre el CI)
 *
 * Siempre desde la base local, nunca desde un proyecto remoto.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

export interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type CliRunner = () => CliResult;

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SUPABASE_CLI = path.join(
  REPO_ROOT,
  "node_modules/supabase/dist/supabase.js",
);
const RELATIVE_TYPES_PATH = "src/lib/database.types.ts";
const GENERATION_TIMEOUT_MS = 120_000;
// El archivo crece con cada tabla. El límite por defecto de Node es 1 MB.
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const CHECK_FLAG = "--check";
const GENERATED_FILE_HEADER =
  "// Archivo generado por `npm run db:types` desde la base local. No lo edites a mano.\n";

export const DATABASE_TYPES_PATH = path.join(REPO_ROOT, RELATIVE_TYPES_PATH);

export const STALE_TYPES_MESSAGE = `Los tipos de la base quedaron viejos: ${RELATIVE_TYPES_PATH} no coincide con las migraciones. Corre \`npm run db:types\` con la base local arriba y sube el archivo.`;

/** Pide a Supabase CLI los tipos del esquema `public` de la base local. */
function runSupabaseGenTypes(): CliResult {
  const result = spawnSync(
    process.execPath,
    [SUPABASE_CLI, "gen", "types", "typescript", "--schema", "public"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: GENERATION_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    // Si el proceso no arrancó, venció el plazo o la salida no cupo, la CLI no
    // escribe nada: el motivo viene en `result.error`.
    stderr: [result.stderr, result.error?.message].filter(Boolean).join("\n"),
  };
}

// El CI corre en Linux y este repo también se trabaja en Windows: todo se
// compara y se escribe con LF.
function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n");
}

/** Dice si el archivo versionado coincide con los tipos recién generados.
 * Solo ignora la diferencia entre CRLF y LF. */
export function areDatabaseTypesCurrent(
  generated: string,
  versioned: string,
): boolean {
  return normalizeLineEndings(generated) === normalizeLineEndings(versioned);
}

/**
 * Genera el contenido completo del archivo de tipos para `filePath`. Supabase
 * CLI entrega el código sin formato, así que pasa por Prettier: el resultado
 * es el mismo en cualquier máquina. Lanza si la CLI falla o no entrega nada.
 */
async function generateDatabaseTypes(
  filePath: string,
  runCli: CliRunner,
): Promise<string> {
  const result = runCli();
  if (result.status !== 0) {
    throw new Error(
      `No se pudieron generar los tipos: Supabase CLI falló. ¿Está arriba la base local? Levántala con \`npm run db:start\`.\n${result.stderr}`,
    );
  }
  const source = normalizeLineEndings(result.stdout);
  if (source.trim() === "") {
    throw new Error("Supabase CLI no devolvió tipos: la salida llegó vacía.");
  }
  const prettierOptions = await resolveConfig(filePath);
  return format(GENERATED_FILE_HEADER + source, {
    ...prettierOptions,
    parser: "typescript",
    endOfLine: "lf",
  });
}

/**
 * Regenera el archivo de tipos. Primero genera todo en memoria y solo
 * entonces reemplaza el archivo, de un solo paso: si algo falla, el archivo
 * versionado queda como estaba.
 */
export async function writeDatabaseTypes(
  filePath: string,
  runCli: CliRunner = runSupabaseGenTypes,
): Promise<void> {
  const generated = await generateDatabaseTypes(filePath, runCli);
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, generated);
  renameSync(temporaryPath, filePath);
}

/** Genera los tipos y dice si el archivo versionado coincide. No lo modifica. */
export async function checkDatabaseTypes(
  filePath: string,
  runCli: CliRunner = runSupabaseGenTypes,
): Promise<boolean> {
  const generated = await generateDatabaseTypes(filePath, runCli);
  return areDatabaseTypesCurrent(generated, readFileSync(filePath, "utf8"));
}

async function main(): Promise<void> {
  if (!process.argv.includes(CHECK_FLAG)) {
    await writeDatabaseTypes(DATABASE_TYPES_PATH);
    console.log(`Tipos regenerados en ${RELATIVE_TYPES_PATH}.`);
    return;
  }
  if (!(await checkDatabaseTypes(DATABASE_TYPES_PATH))) {
    throw new Error(STALE_TYPES_MESSAGE);
  }
  console.log(`${RELATIVE_TYPES_PATH} está al día con la base local.`);
}

const invokedScript = process.argv[1];
const isRunDirectly =
  invokedScript !== undefined &&
  path.resolve(invokedScript) === fileURLToPath(import.meta.url);

if (isRunDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
