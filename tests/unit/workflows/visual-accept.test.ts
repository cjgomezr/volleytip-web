import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../../.github/workflows/visual-baselines.yml",
);
const SNAPSHOT = "tests/ui.spec.ts-snapshots/home-chromium-linux.png";

interface Step {
  id?: string;
  name?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
}

interface Workflow {
  jobs: Record<string, { permissions?: Record<string, string>; steps: Step[] }>;
}

function workflow(): Workflow {
  return load(readFileSync(WORKFLOW_PATH, "utf8")) as Workflow;
}

function findStep(job: string, matches: (step: Step) => boolean): Step {
  const step = workflow().jobs[job]?.steps.find(matches);
  if (!step) {
    throw new Error(`${job} no declara el paso que la prueba busca`);
  }
  return step;
}

const acceptStep = (id: string): Step =>
  findStep("accept", (step) => step.id === id);
const unchangedStep = (): Step =>
  findStep("accept", (step) => step.if === "steps.update.outcome == 'success'");

let workDir = "";

afterEach(async () => {
  if (workDir) {
    await rm(workDir, { recursive: true, force: true, maxRetries: 5 });
    workDir = "";
  }
});

/** Corre un paso como lo hace Actions: con `bash -e`. */
function bash(
  command: string,
  env: Record<string, string> = {},
): { status: number | null; output: string } {
  const result = spawnSync("bash", ["-e", "-c", command], {
    cwd: workDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

async function createWorkDir(): Promise<void> {
  workDir = await mkdtemp(path.join(tmpdir(), "visual-accept-"));
}

/** Un repo con un remoto de verdad, para ver si el paso commitea y empuja. */
async function initRepo(): Promise<void> {
  await createWorkDir();
  await mkdir(path.join(workDir, path.dirname(SNAPSHOT)), { recursive: true });
  await writeFile(path.join(workDir, SNAPSHOT), "original");
  bash(
    "git init -q --bare remote.git && git init -q && git config user.email t@example.com && git config user.name t && git add tests && git commit -qm base && git remote add origin remote.git && git push -qu origin HEAD",
  );
}

const commitCount = (): string =>
  bash("git rev-list --count HEAD").output.trim();

describe("accept: fallo que no es de píxeles", () => {
  it("termina en rojo sin commit, con el mensaje de siempre", async () => {
    await initRepo();
    // Lo que deja el modo corto cuando una prueba sigue fallando: capturas
    // tocadas en disco y nada en el índice.
    await writeFile(path.join(workDir, SNAPSHOT), "regenerada");

    const { status, output } = bash(acceptStep("commit").run ?? "");

    expect(status).toBe(1);
    expect(output).toContain("El fallo no era de píxeles");
    expect(commitCount()).toBe("1");
  });

  it("solo llega a commitear cuando la regeneración salió con error", () => {
    expect(acceptStep("commit").if).toBe("steps.update.outcome == 'failure'");
  });

  it("commitea y empuja las capturas que quedaron en el índice", async () => {
    await initRepo();
    await writeFile(path.join(workDir, SNAPSHOT), "regenerada");
    bash("git add tests");

    const { status } = bash(acceptStep("commit").run ?? "");

    expect(status).toBe(0);
    expect(commitCount()).toBe("2");
    expect(bash("git status -sb").output).not.toContain("ahead");
  });
});

describe("accept: nada cambió", () => {
  it("lo dice en el resumen", async () => {
    await createWorkDir();

    const { status } = bash(unchangedStep().run ?? "", {
      GITHUB_STEP_SUMMARY: "summary.md",
    });

    expect(status).toBe(0);
    expect(await readFile(path.join(workDir, "summary.md"), "utf8")).toMatch(
      /Ninguna captura cambió/,
    );
  });

  it("no commitea ni comenta en el PR", () => {
    const comment = findStep(
      "accept",
      (step) => step.run?.includes("gh pr comment") === true,
    );

    expect(unchangedStep().run).not.toMatch(/git |gh /);
    expect(comment.if).toBe("steps.commit.outcome == 'success'");
  });
});

describe("accept: lee la corrida revisada", () => {
  // Declarar permisos deja en `none` lo que no se lista: sin `actions: read`
  // ni se consulta la corrida ni se baja su artefacto.
  it("puede leer la corrida y su artefacto", () => {
    expect(workflow().jobs.accept?.permissions?.actions).toBe("read");
  });

  it("la resuelve con el script, con el token del workflow", () => {
    const step = acceptStep("reviewed");

    expect(step.run).toContain("scripts/reviewed-run-failures.sh");
    expect(step.env?.GH_TOKEN).toBe("${{ github.token }}");
    expect(step.env?.GH_REPO).toBe("${{ github.repository }}");
  });

  // Playwright vacía test-results/ al arrancar: la lista tiene que vivir fuera.
  it("guarda la lista de fallos fuera del árbol del repositorio", () => {
    expect(acceptStep("reviewed").env?.FAILED_LIST_FILE).toContain(
      "${{ runner.temp }}",
    );
  });

  it("pasa la lista a la regeneración solo cuando la hay", async () => {
    await createWorkDir();
    await mkdir(path.join(workDir, "scripts"));
    await writeFile(
      path.join(workDir, "scripts/update-visual-baselines.sh"),
      'printf "[%s]" "$@"; echo "fin"\n',
    );
    const step = acceptStep("update");

    expect(step.env?.FAILED_LIST).toBe(
      "${{ steps.reviewed.outputs.failed_list }}",
    );
    expect(bash(step.run ?? "", { FAILED_LIST: "/tmp/a b.json" }).output).toBe(
      "[--failed-list][/tmp/a b.json]fin\n",
    );
    expect(bash(step.run ?? "", { FAILED_LIST: "" }).output).toBe("[]fin\n");
  });
});

// El artefacto de `compare` es de donde `accept` saca la lista de fallos.
describe("compare deja la lista de lo que falló", () => {
  it("escribe el reporte JSON dentro de lo que se sube", () => {
    const step = findStep(
      "compare",
      (candidate) => candidate.run?.includes("playwright test") === true,
    );

    expect(step.run).toContain("--reporter=dot,json");
    expect(step.env?.PLAYWRIGHT_JSON_OUTPUT_FILE).toBe(
      "test-results/visual-report.json",
    );
  });
});
