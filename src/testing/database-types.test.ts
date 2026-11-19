import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  areDatabaseTypesCurrent,
  checkDatabaseTypes,
  STALE_TYPES_MESSAGE,
  writeDatabaseTypes,
  type CliResult,
} from "../../scripts/db-types.ts";

const VERSIONED_CONTENT = "export type Database = { antes: true };\n";
const UNFORMATTED_OUTPUT =
  'export type Database = {\n  "public": { a: string,"b": number }\n}';

const temporaryDirectories: string[] = [];

/** Un archivo de tipos ya versionado, en una carpeta temporal. */
function createVersionedFile(content: string = VERSIONED_CONTENT): string {
  const directory = mkdtempSync(path.join(tmpdir(), "db-types-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, "database.types.ts");
  writeFileSync(filePath, content);
  return filePath;
}

function succeedWith(stdout: string): () => CliResult {
  return () => ({ status: 0, stdout, stderr: "" });
}

function failLikeStoppedDatabase(): CliResult {
  return {
    status: 1,
    stdout: "",
    stderr: "failed to connect to postgres: dial tcp 127.0.0.1:54322",
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("db:types", () => {
  it("escribe los tipos generados, con formato y finales de línea LF", async () => {
    const filePath = createVersionedFile();

    await writeDatabaseTypes(filePath, succeedWith(UNFORMATTED_OUTPUT));

    const written = readFileSync(filePath, "utf8");
    expect(written).toContain("public: { a: string; b: number }");
    expect(written).not.toContain("\r");
    expect(written.endsWith("\n")).toBe(true);
  });

  it("avisa arriba del archivo que es generado y cómo regenerarlo", async () => {
    const filePath = createVersionedFile();

    await writeDatabaseTypes(filePath, succeedWith(UNFORMATTED_OUTPUT));

    const [firstLine] = readFileSync(filePath, "utf8").split("\n");
    expect(firstLine).toMatch(/generado/i);
    expect(firstLine).toContain("npm run db:types");
  });

  it("la misma salida produce el mismo archivo aunque llegue con CRLF", async () => {
    const lfPath = createVersionedFile();
    const crlfPath = createVersionedFile();

    await writeDatabaseTypes(lfPath, succeedWith(UNFORMATTED_OUTPUT));
    await writeDatabaseTypes(
      crlfPath,
      succeedWith(UNFORMATTED_OUTPUT.replaceAll("\n", "\r\n")),
    );

    expect(readFileSync(crlfPath, "utf8")).toBe(readFileSync(lfPath, "utf8"));
  });
});

describe("db:types con la base apagada", () => {
  it("falla diciendo cómo levantar la base", async () => {
    const filePath = createVersionedFile();

    await expect(
      writeDatabaseTypes(filePath, failLikeStoppedDatabase),
    ).rejects.toThrow(/npm run db:start/);
  });

  it("incluye lo que dijo Supabase CLI", async () => {
    const filePath = createVersionedFile();

    await expect(
      writeDatabaseTypes(filePath, failLikeStoppedDatabase),
    ).rejects.toThrow(/failed to connect to postgres/);
  });

  it("deja intacto el archivo versionado", async () => {
    const filePath = createVersionedFile();

    await expect(
      writeDatabaseTypes(filePath, failLikeStoppedDatabase),
    ).rejects.toThrow();

    expect(readFileSync(filePath, "utf8")).toBe(VERSIONED_CONTENT);
    expect(readdirSync(path.dirname(filePath))).toEqual(["database.types.ts"]);
  });

  it.each([
    ["vacía", ""],
    ["solo con espacios", " \n\n"],
  ] as const)(
    "una salida %s también falla y no vacía el archivo",
    async (_case, stdout) => {
      const filePath = createVersionedFile();

      await expect(
        writeDatabaseTypes(filePath, succeedWith(stdout)),
      ).rejects.toThrow(/no devolvió tipos/);

      expect(readFileSync(filePath, "utf8")).toBe(VERSIONED_CONTENT);
    },
  );

  it("una salida que no es TypeScript válido falla y no toca el archivo", async () => {
    const filePath = createVersionedFile();

    await expect(
      writeDatabaseTypes(filePath, succeedWith("export type Database = {")),
    ).rejects.toThrow();

    expect(readFileSync(filePath, "utf8")).toBe(VERSIONED_CONTENT);
  });
});

describe("tipos de la base: comparación", () => {
  it("el mensaje de fallo nombra npm run db:types", () => {
    expect(STALE_TYPES_MESSAGE).toContain("npm run db:types");
  });

  it("dos textos iguales están al día", () => {
    expect(areDatabaseTypesCurrent("a\nb\n", "a\nb\n")).toBe(true);
  });

  it("CRLF contra LF no cuenta como diferencia", () => {
    expect(areDatabaseTypesCurrent("a\nb\n", "a\r\nb\r\n")).toBe(true);
  });

  it("cualquier otra diferencia sí cuenta", () => {
    expect(areDatabaseTypesCurrent("a\nb\n", "a\nc\n")).toBe(false);
    expect(areDatabaseTypesCurrent("a\nb\n", "a\nb")).toBe(false);
  });

  it("el chequeo pasa cuando el archivo coincide y no lo modifica", async () => {
    const filePath = createVersionedFile();
    await writeDatabaseTypes(filePath, succeedWith(UNFORMATTED_OUTPUT));
    const before = readFileSync(filePath, "utf8").replaceAll("\n", "\r\n");
    writeFileSync(filePath, before);

    const isCurrent = await checkDatabaseTypes(
      filePath,
      succeedWith(UNFORMATTED_OUTPUT),
    );

    expect(isCurrent).toBe(true);
    expect(readFileSync(filePath, "utf8")).toBe(before);
  });

  it("el chequeo detecta un archivo viejo y no lo modifica", async () => {
    const filePath = createVersionedFile();

    const isCurrent = await checkDatabaseTypes(
      filePath,
      succeedWith(UNFORMATTED_OUTPUT),
    );

    expect(isCurrent).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(VERSIONED_CONTENT);
  });

  it("el chequeo con la base apagada falla en vez de dar el archivo por bueno", async () => {
    const filePath = createVersionedFile();

    await expect(
      checkDatabaseTypes(filePath, failLikeStoppedDatabase),
    ).rejects.toThrow(/npm run db:start/);
  });
});
