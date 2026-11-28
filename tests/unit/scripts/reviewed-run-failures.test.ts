import { spawn, spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(REPO_ROOT, "scripts/reviewed-run-failures.sh");

const RUN_ID = "4242";
const RUN_URL = `https://github.com/acme/repo/actions/runs/${RUN_ID}`;
const WORKFLOW_PATH = ".github/workflows/visual-baselines.yml";
const OTHER_SHA = "cccccccccccccccccccccccccccccccccccccccc";

const REMOVE_TEMP_DIR_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 200,
} as const;

interface FakeTest {
  id: string;
  project?: string;
  status: "expected" | "unexpected" | "flaky" | "skipped";
  expectedStatus?: "passed" | "skipped";
  results?: string[];
}

/** El reporte JSON de Playwright, en lo que al script le importa. */
function report(tests: FakeTest[], errors: unknown[] = []): unknown {
  const specs = tests.map((test) => ({
    id: test.id,
    tests: [
      {
        projectName: test.project ?? "sitio",
        status: test.status,
        expectedStatus: test.expectedStatus ?? "passed",
        results: (test.results ?? []).map((status) => ({ status })),
      },
    ],
  }));
  // Un spec suelto y el resto dentro de un `describe`: el reporte los anida.
  return {
    errors,
    suites: [{ specs: specs.slice(0, 1), suites: [{ specs: specs.slice(1) }] }],
  };
}

const failed = (id: string, project?: string): FakeTest => ({
  id,
  project,
  status: "unexpected",
  results: ["failed"],
});
const passed = (id: string): FakeTest => ({
  id,
  status: "expected",
  results: ["passed"],
});
const notRun = (id: string, project?: string): FakeTest => ({
  id,
  project,
  status: "skipped",
});

interface Scenario {
  url?: string;
  run?: Partial<{ path: string; conclusion: string; head_sha: string }> | null;
  /** `null`: el artefacto venció o la corrida no subió ninguno. */
  report?: unknown;
  /** Dónde queda el reporte dentro del artefacto descargado. */
  reportDir?: string;
}

interface RunResult {
  code: number | null;
  summary: string;
  output: string;
  failedIds: string[] | undefined;
  ghCalls: string;
}

function toBashPath(nativePath: string): string {
  return nativePath.replace(/\\/g, "/");
}

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * `gh` de mentira: `gh api` contesta la corrida aplicando con `jq` la misma
 * expresión que pide el script, y `gh run download` copia el reporte que el
 * escenario tenga. Un archivo que falta es una llamada que falla.
 */
async function installFakeGh(workDir: string): Promise<string> {
  const binDir = path.join(workDir, "stub-bin");
  await mkdir(binDir, { recursive: true });
  const script = `#!/usr/bin/env bash
echo "$@" >> "${toBashPath(path.join(workDir, "gh-calls.log"))}"
if [ "$1" = "api" ]; then
  [ -f "$RUN_FILE" ] || exit 1
  [ "$2" = "repos/acme/repo/actions/runs/${RUN_ID}" ] || exit 1
  jq -r "$4" "$RUN_FILE"
  exit
fi
if [ "$1 $2 $3 $4 $5 $6" = "run download ${RUN_ID} -n visual-diff -D" ]; then
  [ -f "$REPORT_FILE" ] || exit 1
  mkdir -p "$7/$REPORT_DIR"
  cp "$REPORT_FILE" "$7/$REPORT_DIR/visual-report.json"
  exit
fi
exit 1
`;
  await writeFile(path.join(binDir, "gh"), script);
  await chmod(path.join(binDir, "gh"), 0o755);
  return binDir;
}

let workDir = "";

afterEach(async () => {
  if (workDir) {
    await rm(workDir, REMOVE_TEMP_DIR_OPTIONS);
    workDir = "";
  }
});

async function resolveRun(scenario: Scenario = {}): Promise<RunResult> {
  workDir = await mkdtemp(path.join(tmpdir(), "reviewed-run-"));
  const binDir = await installFakeGh(workDir);
  git(workDir, "init", "-q");
  git(workDir, "config", "user.email", "test@example.com");
  git(workDir, "config", "user.name", "test");
  git(workDir, "commit", "-q", "--allow-empty", "-m", "cabeza de la rama");
  const head = git(workDir, "rev-parse", "HEAD");

  const files = {
    run: path.join(workDir, "run.json"),
    report: path.join(workDir, "report.json"),
    list: path.join(workDir, "failed.json"),
    output: path.join(workDir, "github-output"),
    summary: path.join(workDir, "step-summary"),
    ghCalls: path.join(workDir, "gh-calls.log"),
  };
  if (scenario.run !== null) {
    await writeFile(
      files.run,
      JSON.stringify({
        path: WORKFLOW_PATH,
        conclusion: "failure",
        head_sha: head,
        ...scenario.run,
      }),
    );
  }
  if (scenario.report !== null) {
    const contents =
      scenario.report ?? report([failed("aa-11"), passed("bb-22")]);
    await writeFile(
      files.report,
      typeof contents === "string" ? contents : JSON.stringify(contents),
    );
  }
  await writeFile(files.output, "");
  await writeFile(files.summary, "");
  await writeFile(files.ghCalls, "");

  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn("bash", [toBashPath(SCRIPT)], {
      cwd: workDir,
      env: {
        ...process.env,
        GH_REPO: "acme/repo",
        REVIEWED_RUN_URL: scenario.url ?? RUN_URL,
        FAILED_LIST_FILE: toBashPath(files.list),
        GITHUB_OUTPUT: toBashPath(files.output),
        GITHUB_STEP_SUMMARY: toBashPath(files.summary),
        RUN_FILE: toBashPath(files.run),
        REPORT_FILE: toBashPath(files.report),
        REPORT_DIR: scenario.reportDir ?? "test-results",
        PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      },
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", resolve);
  });

  const list = await readFile(files.list, "utf8").catch(() => undefined);
  return {
    code,
    summary: await readFile(files.summary, "utf8"),
    output: await readFile(files.output, "utf8"),
    failedIds: list
      ? (JSON.parse(list) as { failedTests: string[] }).failedTests
      : undefined,
    ghCalls: await readFile(files.ghCalls, "utf8"),
  };
}

function expectFullSuite(result: RunResult, reason: RegExp): void {
  expect(result.code).toBe(0);
  expect(result.failedIds).toBeUndefined();
  expect(result.output).toMatch(/^failed_list=$/m);
  expect(result.summary).toMatch(/Modo: suite completa/);
  expect(result.summary).toMatch(reason);
}

describe("accept: corrida revisada con fallos", () => {
  it("entrega solo las pruebas que fallaron", async () => {
    const { failedIds, output } = await resolveRun({
      report: report([failed("aa-11"), passed("bb-22"), failed("cc-33")]),
    });

    expect(failedIds).toEqual(["aa-11", "cc-33"]);
    expect(output).toMatch(/^failed_list=.+failed\.json$/m);
  });

  it("anota la dirección, el modo corto y cuántas pruebas se regeneran", async () => {
    const { summary } = await resolveRun({
      report: report([failed("aa-11"), failed("cc-33")]),
    });

    expect(summary).toContain(RUN_URL);
    expect(summary).toMatch(/Modo: corto/);
    expect(summary).toMatch(/Pruebas que se regeneran: 2/);
  });

  it("no arrastra las de un proyecto que no llegó a correr por su dependencia", async () => {
    const { failedIds } = await resolveRun({
      report: report([
        failed("aa-11"),
        notRun("dd-44", "ajustes-que-escriben"),
      ]),
    });

    expect(failedIds).toEqual(["aa-11"]);
  });

  // En un grupo en serie, o tras un `beforeAll` roto, las siguientes del mismo
  // proyecto se quedan sin correr: nadie sabe si su captura cambió.
  it("incluye las que se quedaron sin correr en un proyecto que sí corrió", async () => {
    const { failedIds } = await resolveRun({
      report: report([failed("aa-11"), notRun("bb-22")]),
    });

    expect(failedIds).toEqual(["aa-11", "bb-22"]);
  });

  it("deja fuera las que están saltadas a propósito", async () => {
    const { failedIds } = await resolveRun({
      report: report([
        failed("aa-11"),
        {
          id: "bb-22",
          status: "skipped",
          expectedStatus: "skipped",
          results: ["skipped"],
        },
      ]),
    });

    expect(failedIds).toEqual(["aa-11"]);
  });

  it.each([
    `${RUN_URL}/`,
    `${RUN_URL}/attempts/2`,
    `${RUN_URL}/job/99`,
    `${RUN_URL}?pr=7`,
    "https://github.com/Acme/Repo/actions/runs/4242",
  ])("acepta la dirección tal como se copia: %s", async (url) => {
    const { failedIds } = await resolveRun({ url });

    expect(failedIds).toEqual(["aa-11"]);
  });

  it("encuentra el reporte aunque el artefacto lo deje en la raíz", async () => {
    const { failedIds } = await resolveRun({ reportDir: "." });

    expect(failedIds).toEqual(["aa-11"]);
  });

  it("reconoce el workflow aunque la API le añada la referencia", async () => {
    const { failedIds } = await resolveRun({
      run: { path: `${WORKFLOW_PATH}@refs/heads/impl-1` },
    });

    expect(failedIds).toEqual(["aa-11"]);
  });
});

describe("accept: corrida revisada de otro commit", () => {
  it("no usa su lista y cae a la suite completa", async () => {
    const result = await resolveRun({ run: { head_sha: OTHER_SHA } });

    expectFullSuite(result, /otro commit/);
    expect(result.summary).toContain(OTHER_SHA);
    expect(result.ghCalls).not.toMatch(/run download/);
  });
});

describe("accept: dirección inválida, corrida verde o artefacto vencido", () => {
  it.each([
    "ya la miré",
    "https://github.com/otro/repo/actions/runs/4242",
    "https://github.com/acme/repo/pull/4242",
    "https://github.com/acme/repo/actions/runs/4242x",
  ])("cae a la suite completa con la dirección %s", async (url) => {
    const result = await resolveRun({ url });

    expectFullSuite(result, /no es de una corrida de este repositorio/);
    expect(result.summary).toContain(url);
    expect(result.ghCalls).toBe("");
  });

  it("cae a la suite completa si GitHub no encuentra la corrida", async () => {
    expectFullSuite(await resolveRun({ run: null }), /no pude consultar/);
  });

  it("cae a la suite completa si la corrida es de otro workflow", async () => {
    const result = await resolveRun({
      run: { path: ".github/workflows/checks.yml" },
    });

    expectFullSuite(result, /no es de este workflow/);
  });

  it("cae a la suite completa si la corrida salió en verde", async () => {
    const result = await resolveRun({ run: { conclusion: "success" } });

    expectFullSuite(result, /no salió en rojo/);
  });

  it("cae a la suite completa si el artefacto venció o no existe", async () => {
    const result = await resolveRun({ report: null });

    expectFullSuite(result, /artefacto visual-diff/);
  });

  it("cae a la suite completa si el reporte no se puede leer", async () => {
    const result = await resolveRun({ report: "{roto" });

    expectFullSuite(result, /no se puede leer/);
  });

  it("cae a la suite completa si la corrida tuvo errores fuera de las pruebas", async () => {
    const result = await resolveRun({
      report: report([failed("aa-11")], [{ message: "globalSetup" }]),
    });

    expectFullSuite(result, /errores fuera de las pruebas/);
  });

  it("cae a la suite completa si el reporte no trae ninguna prueba fallida", async () => {
    const result = await resolveRun({ report: report([passed("bb-22")]) });

    expectFullSuite(result, /ninguna prueba fallida/);
  });

  it("anota que la suite completa regenera todas las pruebas", async () => {
    const { summary } = await resolveRun({ report: null });

    expect(summary).toContain(RUN_URL);
    expect(summary).toMatch(/Pruebas que se regeneran: toda la suite/);
  });
});
