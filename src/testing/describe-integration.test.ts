import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const VITEST_ENTRY = fileURLToPath(
  new URL("../../node_modules/vitest/vitest.mjs", import.meta.url),
);
const SMOKE_TEST_FILE = "src/testing/local-database.integration.test.ts";
const CHILD_RUN_TIMEOUT_MS = 30_000;

interface VitestJsonReport {
  readonly numTotalTests: number;
  readonly numPassedTests: number;
  readonly numFailedTests: number;
  readonly numPendingTests: number;
}

/** Corre la prueba de humo en un Vitest aparte, sin RUN_INTEGRATION_TESTS,
 * y devuelve su resumen. Es la única forma de ver qué registra de verdad
 * `describeIntegration`: un bloque no se puede declarar dentro de un test. */
function runSmokeTestWithoutFlag(): VitestJsonReport {
  const environment = { ...process.env };
  delete environment.RUN_INTEGRATION_TESTS;

  const result = spawnSync(
    process.execPath,
    [VITEST_ENTRY, "run", SMOKE_TEST_FILE, "--reporter=json"],
    {
      cwd: REPO_ROOT,
      env: environment,
      encoding: "utf8",
      timeout: CHILD_RUN_TIMEOUT_MS,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Vitest terminó con código ${String(result.status)}: ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout) as VitestJsonReport;
}

describe("pruebas de integración sin RUN_INTEGRATION_TESTS", () => {
  it(
    "se registran como saltadas y el resumen las cuenta",
    () => {
      const report = runSmokeTestWithoutFlag();

      expect(report.numTotalTests).toBeGreaterThan(0);
      expect(report.numPendingTests).toBe(report.numTotalTests);
      expect(report.numPassedTests).toBe(0);
      expect(report.numFailedTests).toBe(0);
    },
    CHILD_RUN_TIMEOUT_MS,
  );
});
