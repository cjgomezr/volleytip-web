import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const VITEST_ENTRY = fileURLToPath(
  new URL("../../node_modules/vitest/vitest.mjs", import.meta.url),
);
const FIXTURE_CONFIG = "src/testing/fixtures/vitest.fixture.config.ts";
const CHILD_RUN_TIMEOUT_MS = 30_000;

interface VitestJsonReport {
  readonly numTotalTests: number;
  readonly numPassedTests: number;
  readonly numFailedTests: number;
  readonly numPendingTests: number;
  readonly numFailedTestSuites: number;
}

type Reporter = "json" | "default";

interface ChildOutput {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Corre en un Vitest aparte un bloque de integración que apunta a un puerto
 * cerrado, con el valor de RUN_INTEGRATION_TESTS que se pida. Es la única
 * forma de ver qué registra de verdad `describeIntegration`: un bloque no se
 * puede declarar dentro de un test.
 */
function runUnreachableDatabaseFixture(
  flag: string | undefined,
  reporter: Reporter,
): ChildOutput {
  const environment = { ...process.env };
  delete environment.RUN_INTEGRATION_TESTS;
  if (flag !== undefined) {
    environment.RUN_INTEGRATION_TESTS = flag;
  }

  const result = spawnSync(
    process.execPath,
    [VITEST_ENTRY, "run", "--config", FIXTURE_CONFIG, `--reporter=${reporter}`],
    {
      cwd: REPO_ROOT,
      env: environment,
      encoding: "utf8",
      timeout: CHILD_RUN_TIMEOUT_MS,
    },
  );
  if (result.error !== undefined) {
    throw result.error;
  }
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseReport({ stdout }: ChildOutput): VitestJsonReport {
  return JSON.parse(stdout) as VitestJsonReport;
}

describe("pruebas de integración sin RUN_INTEGRATION_TESTS", () => {
  it(
    "se registran como saltadas y el resumen las cuenta",
    () => {
      const run = runUnreachableDatabaseFixture(undefined, "json");
      const report = parseReport(run);

      expect(run.exitCode).toBe(0);
      expect(report.numTotalTests).toBeGreaterThan(0);
      expect(report.numPendingTests).toBe(report.numTotalTests);
      expect(report.numFailedTests).toBe(0);
    },
    CHILD_RUN_TIMEOUT_MS,
  );
});

describe("pruebas de integración con RUN_INTEGRATION_TESTS=1 y la base apagada", () => {
  it(
    "fallan, no se saltan",
    () => {
      const run = runUnreachableDatabaseFixture("1", "json");
      const report = parseReport(run);

      expect(run.exitCode).not.toBe(0);
      expect(report.numFailedTestSuites).toBeGreaterThan(0);
      expect(report.numPassedTests).toBe(0);
    },
    CHILD_RUN_TIMEOUT_MS,
  );

  it(
    "el fallo dice que la base local no responde y cómo levantarla",
    () => {
      const { stdout, stderr } = runUnreachableDatabaseFixture("1", "default");
      const text = stdout + stderr;

      expect(text).toContain("base local no responde");
      expect(text).toContain("npm run db:start");
    },
    CHILD_RUN_TIMEOUT_MS,
  );
});
