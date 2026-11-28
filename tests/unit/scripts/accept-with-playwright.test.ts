import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";

/**
 * El modo corto contra el Playwright de verdad, sin navegador: los otros tests
 * usan dobles y no pueden decir si el reporte tiene la forma que el script
 * lee, ni si `--last-failed-file` con `--no-deps` corre solo lo pedido.
 */
const REPO_ROOT = path.resolve(__dirname, "../../..");
const SNAPSHOTS = "tests/ui.spec.ts-snapshots";
const PLAYWRIGHT_TIMEOUT_MS = 120_000;

interface Workflow {
  jobs: Record<
    string,
    { steps: { run?: string; env?: Record<string, string> }[] }
  >;
}

const CONFIG = `
module.exports = {
  testDir: "./tests",
  snapshotPathTemplate: "{testDir}/ui.spec.ts-snapshots/{arg}{ext}",
  projects: [
    { name: "sitio", testMatch: "ui.spec.js" },
    { name: "que-escriben", testMatch: "writes.spec.js", dependencies: ["sitio"] },
  ],
};
`;

const SITE_SPEC = `
const { test, expect } = require("@playwright/test");
const { appendFileSync } = require("node:fs");
const ran = (name) => appendFileSync("ran.log", name + "\\n");

test("captura que cambió", () => {
  ran("cambió");
  expect("imagen nueva").toMatchSnapshot("changed.txt");
});
test("captura nueva", () => {
  ran("nueva");
  expect("pantalla sin línea base").toMatchSnapshot("new.txt");
});
test("captura al día", () => {
  ran("al día");
  expect("imagen igual").toMatchSnapshot("same.txt");
});
`;

const WRITES_SPEC = `
const { test } = require("@playwright/test");
const { appendFileSync } = require("node:fs");
test("escribe", () => appendFileSync("ran.log", "escribe\\n"));
`;

function toBashPath(nativePath: string): string {
  return nativePath.replace(/\\/g, "/");
}

const scriptPath = (name: string): string =>
  toBashPath(path.join(REPO_ROOT, "scripts", name));

let workDir = "";

afterEach(async () => {
  if (workDir) {
    await rm(workDir, { recursive: true, force: true, maxRetries: 5 });
    workDir = "";
  }
});

function bash(
  command: string,
  env: Record<string, string> = {},
): { status: number | null; output: string } {
  const result = spawnSync("bash", ["-c", command], {
    cwd: workDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

async function write(file: string, contents: string): Promise<void> {
  const target = path.join(workDir, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function createProject(): Promise<void> {
  // Dentro del repo para que `npx` y `@playwright/test` se resuelvan.
  workDir = await mkdtemp(path.join(REPO_ROOT, ".tmp-playwright-"));
  await write("package.json", '{"type":"commonjs"}');
  await write("playwright.config.js", CONFIG);
  await write("tests/ui.spec.js", SITE_SPEC);
  await write("tests/writes.spec.js", WRITES_SPEC);
  await write(`${SNAPSHOTS}/changed.txt`, "imagen vieja");
  await write(`${SNAPSHOTS}/same.txt`, "imagen igual");
  await write(
    ".gitignore",
    "test-results/\nartifact/\nbin/\nran.log\nfailed-list.json\nsummary.md\noutput.txt\n",
  );
  bash(
    "git init -q && git config user.email t@example.com && git config user.name t && git add . && git commit -qm base",
  );
}

/** El paso de `compare`, tal como lo declara el workflow. */
async function compareStep(): Promise<{
  run: string;
  env: Record<string, string>;
}> {
  const source = await readFile(
    path.join(REPO_ROOT, ".github/workflows/visual-baselines.yml"),
    "utf8",
  );
  const step = (load(source) as Workflow).jobs.compare?.steps.find(
    (candidate) => candidate.run?.includes("playwright test"),
  );
  if (!step?.run) {
    throw new Error("compare no corre Playwright");
  }
  return { run: step.run, env: step.env ?? {} };
}

/** `gh` de mentira que entrega la corrida en rojo y su artefacto. */
async function installFakeGh(headSha: string): Promise<string> {
  await write(
    "bin/gh",
    `#!/usr/bin/env bash
if [ "$1" = "api" ]; then
  printf '.github/workflows/visual-baselines.yml\\tfailure\\t${headSha}\\n'
else
  cp -r "${toBashPath(workDir)}/artifact/." "$7"
fi
`,
  );
  await chmod(path.join(workDir, "bin/gh"), 0o755);
  return `${path.join(workDir, "bin")}${path.delimiter}${process.env.PATH}`;
}

describe("accept: modo corto con Playwright de verdad", () => {
  it(
    "deja en el índice solo las capturas que fallaron: la modificada y la nueva",
    async () => {
      await createProject();
      const compare = await compareStep();
      expect(bash(compare.run, compare.env).status).toBe(1);
      // `git clean`: la comparación escribe la captura que faltaba, y `accept`
      // parte de un checkout limpio que no la tiene.
      bash(
        "mkdir artifact && cp -r test-results artifact/ && rm ran.log && git clean -fq tests",
      );
      const head = bash("git rev-parse HEAD").output.trim();
      const list = `${toBashPath(workDir)}/failed-list.json`;
      const resolved = bash(
        `bash "${scriptPath("reviewed-run-failures.sh")}"`,
        {
          GH_REPO: "acme/repo",
          REVIEWED_RUN_URL: "https://github.com/acme/repo/actions/runs/1",
          FAILED_LIST_FILE: list,
          // En CI estas dos apuntan al resumen y a las salidas del job real.
          GITHUB_STEP_SUMMARY: "summary.md",
          GITHUB_OUTPUT: "output.txt",
          PATH: await installFakeGh(head),
        },
      );
      expect(resolved.output).toContain("Modo: corto");

      const update = bash(
        `bash "${scriptPath("update-visual-baselines.sh")}" --failed-list "${list}"`,
      );

      expect(update.output).toContain("línea base regenerada");
      expect(await readFile(path.join(workDir, "ran.log"), "utf8")).toBe(
        "cambió\nnueva\n",
      );
      expect(bash("git diff --cached --name-only").output.trim()).toBe(
        `${SNAPSHOTS}/changed.txt\n${SNAPSHOTS}/new.txt`,
      );
    },
    PLAYWRIGHT_TIMEOUT_MS,
  );
});
