import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

import {
  connectToLocalDatabase,
  takeOnlyRow,
  type Database,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

// El workflow de migraciones (.github/workflows/migrations.yml) aplica las
// migraciones con `supabase db push`. Aquí se corre ese mismo comando contra
// la base local, que es su destino cuando no lleva `--remote`.

const REPO_ROOT = path.resolve(__dirname, "../..");
const SUPABASE_CLI = path.join(
  REPO_ROOT,
  "node_modules/supabase/dist/supabase.js",
);
const PUSH_TIMEOUT_MS = 60_000;

// Versión muy posterior a cualquier migración real, para que la CLI la vea
// como la única pendiente.
const BROKEN_MIGRATION_VERSION = "20991231235959";
const BROKEN_MIGRATION_TABLE = "prueba_migracion_a_medias";
// Crea una tabla, le pone una fila y falla en la tercera sentencia.
const BROKEN_MIGRATION_SQL = `
create table public.${BROKEN_MIGRATION_TABLE} (id integer);
insert into public.${BROKEN_MIGRATION_TABLE} (id) values (1);
select 1 / 0;
`;

interface PushResult {
  readonly status: number | null;
  readonly output: string;
}

let database: Database;
let workdirWithBrokenMigration: string;

function pushMigrations(workdir: string): PushResult {
  const result = spawnSync(
    process.execPath,
    [SUPABASE_CLI, "db", "push", "--yes", "--workdir", workdir],
    {
      encoding: "utf8",
      timeout: PUSH_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return {
    status: result.status,
    output: [result.stdout, result.stderr, result.error?.message]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Copia `supabase/` a una carpeta temporal y le agrega la migración rota. El
 * repo no se toca. */
function createWorkdirWithBrokenMigration(): string {
  const workdir = mkdtempSync(path.join(tmpdir(), "volleytip-migraciones-"));
  cpSync(path.join(REPO_ROOT, "supabase"), path.join(workdir, "supabase"), {
    recursive: true,
  });
  writeFileSync(
    path.join(
      workdir,
      "supabase/migrations",
      `${BROKEN_MIGRATION_VERSION}_prueba_a_medias.sql`,
    ),
    BROKEN_MIGRATION_SQL,
  );
  return workdir;
}

async function readAppliedVersions(): Promise<string[]> {
  const rows = await database<{ version: string }[]>`
    select version from supabase_migrations.schema_migrations order by version
  `;
  return rows.map((row) => row.version);
}

async function brokenMigrationTableExists(): Promise<boolean> {
  const rows = await database<{ table_exists: boolean }[]>`
    select to_regclass(${`public.${BROKEN_MIGRATION_TABLE}`}) is not null as table_exists
  `;
  return takeOnlyRow(rows, "to_regclass").table_exists;
}

beforeAll(() => {
  database = connectToLocalDatabase();
  workdirWithBrokenMigration = createWorkdirWithBrokenMigration();
});

afterAll(async () => {
  rmSync(workdirWithBrokenMigration, { recursive: true, force: true });
  await database.end();
});

describeIntegration("supabase db push: sin migraciones nuevas", () => {
  it(
    "termina bien y no cambia el historial",
    async () => {
      const before = await readAppliedVersions();

      const result = pushMigrations(REPO_ROOT);

      expect(result.status, result.output).toBe(0);
      expect(await readAppliedVersions()).toEqual(before);
    },
    PUSH_TIMEOUT_MS,
  );
});

describeIntegration("supabase db push: migración que falla a mitad", () => {
  it(
    "falla, no deja nada de la migración y no la registra como aplicada",
    async () => {
      const before = await readAppliedVersions();

      const result = pushMigrations(workdirWithBrokenMigration);

      expect(result.status, result.output).not.toBe(0);
      expect(result.output).toContain("division by zero");
      expect(await brokenMigrationTableExists()).toBe(false);
      expect(await readAppliedVersions()).toEqual(before);
      expect(before).not.toContain(BROKEN_MIGRATION_VERSION);
    },
    PUSH_TIMEOUT_MS,
  );
});
