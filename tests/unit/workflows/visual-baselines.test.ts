import { readFileSync } from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKFLOW_PATH = path.join(
  REPO_ROOT,
  ".github/workflows/visual-baselines.yml",
);

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  "continue-on-error"?: boolean;
  env?: Record<string, string>;
}

interface WorkflowJob {
  if?: string;
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps: WorkflowStep[];
}

interface WorkflowFile {
  on: {
    push?: { branches?: string[] };
    pull_request?: { types?: string[] };
    workflow_dispatch?: {
      inputs?: Record<string, { required?: boolean }>;
    } | null;
  };
  permissions: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
}

function parseWorkflow(): WorkflowFile {
  return load(readFileSync(WORKFLOW_PATH, "utf8")) as WorkflowFile;
}

function stepsOf(jobName: string): WorkflowStep[] {
  const job = parseWorkflow().jobs[jobName];
  if (!job) {
    throw new Error(`El workflow no declara el job "${jobName}".`);
  }
  return job.steps;
}

function runLines(jobName: string): string {
  return stepsOf(jobName)
    .map((step) => step.run ?? "")
    .join("\n");
}

describe("visual-baselines.yml", () => {
  it("parsea como YAML válido", () => {
    expect(() => parseWorkflow()).not.toThrow();
  });

  it("corre en cada pull request, no sólo cuando alguien se acuerda", () => {
    const { on } = parseWorkflow();

    expect(on.pull_request?.types).toContain("opened");
    expect(on.pull_request?.types).toContain("synchronize");
  });

  it("compara la línea base en los pull requests", () => {
    expect(parseWorkflow().jobs.compare?.if).toContain("pull_request");
    expect(runLines("compare")).toMatch(/npx playwright test/);
  });

  it("no regenera ni reescribe la línea base durante un pull request", () => {
    const runs = runLines("compare");

    expect(runs).not.toMatch(/--update-snapshots/);
    expect(runs).not.toMatch(/git commit/);
    expect(runs).not.toMatch(/git push/);
  });

  it("no pide permiso de escritura para comparar, que es lo que un fork no puede dar", () => {
    const workflow = parseWorkflow();

    expect(workflow.permissions.contents).toBe("read");
    expect(workflow.jobs.compare?.permissions).toBeUndefined();
  });

  it("guarda el diff cuando la comparación falla, para que quede algo que mirar", () => {
    const artifact = stepsOf("compare").find((step) =>
      step.uses?.startsWith("actions/upload-artifact"),
    );

    expect(artifact).toBeDefined();
    expect(artifact?.if).toBe("failure()");
  });

  it("acepta una línea base nueva sólo cuando un humano lanza el workflow", () => {
    const accept = parseWorkflow().jobs.accept;

    expect(accept).toBeDefined();
    expect(accept?.if).toContain("workflow_dispatch");
    expect(accept?.permissions?.contents).toBe("write");
    expect(runLines("accept")).toMatch(/update-visual-baselines\.sh/);
    expect(runLines("accept")).toMatch(/git push/);
  });

  it("pide la corrida revisada antes de aceptar, para que no sea un botón a ciegas", () => {
    const dispatch = parseWorkflow().on.workflow_dispatch;

    expect(dispatch?.inputs?.reviewed_run_url?.required).toBe(true);
    expect(
      stepsOf("accept").map((step) => step.env?.REVIEWED_RUN_URL),
    ).toContain("${{ inputs.reviewed_run_url }}");
  });

  // Lo que escribe quien lanza el workflow llega al shell como dato: pegado
  // dentro de `run` se ejecutaría con permiso de escritura sobre el repo.
  it("no interpola la dirección dentro de un comando", () => {
    expect(runLines("accept")).not.toMatch(/inputs\./);
  });

  it("no necesita ignorar sus propios commits, porque no los hace en un PR", () => {
    const source = readFileSync(WORKFLOW_PATH, "utf8");

    expect(source).not.toMatch(/github\.actor\s*!=/);
  });
});

describe("gate visual en main", () => {
  it("compara también en cada push a main, no sólo en pull requests", () => {
    const { on } = parseWorkflow();

    expect(on.push?.branches).toContain("main");
  });

  it("la comparación corre tanto en pull_request como en push", () => {
    const condition = parseWorkflow().jobs.compare?.if ?? "";

    expect(condition).toMatch(/pull_request/);
    expect(condition).toMatch(/push/);
  });

  it("el job que abre el incidente sólo corre en push y sólo cuando la comparación falló", () => {
    const job = parseWorkflow().jobs["report-incident"];

    expect(job).toBeDefined();
    expect(job?.needs).toContain("compare");
    expect(job?.if).toMatch(/push/);
    expect(job?.if).toMatch(/needs\.compare\.result\s*==\s*'failure'/);
    expect(job?.if).not.toMatch(/pull_request/);
  });

  it("el paso que abre el incidente invoca scripts/file-incident.sh, no gh issue create a pelo", () => {
    const runs = runLines("report-incident");

    expect(runs).toMatch(/report-visual-incident\.sh/);
    expect(runs).not.toMatch(/gh issue create/);
  });

  it("el job del incidente puede crear issues y leer el repo para el checkout", () => {
    const job = parseWorkflow().jobs["report-incident"];

    expect(job?.permissions?.issues).toBe("write");
    expect(job?.permissions?.contents).toBe("read");
  });

  it("el job del incidente corre aunque compare haya fallado, no sólo cuando compare tiene éxito", () => {
    const condition = parseWorkflow().jobs["report-incident"]?.if ?? "";

    expect(condition).toMatch(/always\(\)/);
  });

  it("avisa en el PR cuando accept empuja su commit", () => {
    const runs = runLines("accept");

    expect(runs).toMatch(/gh pr comment/);
  });

  it("el job accept puede comentar en el PR", () => {
    const accept = parseWorkflow().jobs.accept;

    expect(accept?.permissions?.["pull-requests"]).toBe("write");
  });
});
const VISUAL_PATHS_LIST = path.join(REPO_ROOT, ".github/visual-paths.txt");

/** Las rutas del archivo compartido, sin comentarios ni líneas vacías. */
function readVisualPathsList(): string[] {
  return readFileSync(VISUAL_PATHS_LIST, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

interface TriggerPaths {
  on: {
    pull_request?: { paths?: string[] };
    push?: { paths?: string[] };
  };
}

// El Stop gate decide si corre Playwright con la misma lista que filtra este
// workflow. Actions no sabe leer `paths` de un archivo, así que la lista vive
// en los dos sitios y este test impide que se separen.
describe("la lista de rutas visuales compartida con el Stop gate", () => {
  it("es la misma que filtra los pull requests", () => {
    const workflow = parseWorkflow() as unknown as TriggerPaths;

    expect(readVisualPathsList()).toEqual(workflow.on.pull_request?.paths);
  });

  it("es la misma que filtra los push a main", () => {
    const workflow = parseWorkflow() as unknown as TriggerPaths;

    expect(readVisualPathsList()).toEqual(workflow.on.push?.paths);
  });
});

const GATE_JOB = "arbol-ya-verificado";
const SKIP_UNLESS_VERIFIED = `needs.${GATE_JOB}.outputs.ya_verificado != 'true'`;

interface GateJob {
  if?: string;
  outputs?: Record<string, string>;
  permissions?: Record<string, string>;
  steps: { run?: string; env?: Record<string, string> }[];
}

function gateJob(): GateJob | undefined {
  return parseWorkflow().jobs[GATE_JOB] as GateJob | undefined;
}

// Cada push a main repetía la visual entera sobre el árbol que su PR acababa
// de comparar en verde. El job previo lo averigua en segundos.
describe("main no repite la visual que el PR ya pasó", () => {
  it("pregunta primero, en un job que expone ya_verificado", () => {
    expect(Object.keys(gateJob()?.outputs ?? {})).toContain("ya_verificado");
  });

  it("la pregunta sólo se hace en push, nunca en un PR ni en una aceptación", () => {
    expect(gateJob()?.if).toBe("github.event_name == 'push'");
  });

  it("la responde el script compartido con checks.yml, apuntado a este workflow", () => {
    const step = gateJob()?.steps.find((candidate) =>
      candidate.run?.includes("checks-already-green-on-pr.sh"),
    );

    expect(step?.env?.WORKFLOW_FILE).toBe("visual-baselines.yml");
    expect(step?.env?.HEAD_COMMIT_MESSAGE).toBe(
      "${{ github.event.head_commit.message }}",
    );
  });

  it("la pregunta sólo pide permisos de lectura", () => {
    const permissions = gateJob()?.permissions ?? {};

    expect(Object.values(permissions)).not.toContain("write");
  });

  it("compare depende de la pregunta y se salta sólo cuando la respuesta es que sí", () => {
    const compare = parseWorkflow().jobs.compare;

    expect(compare?.needs).toContain(GATE_JOB);
    expect(compare?.if).toContain(SKIP_UNLESS_VERIFIED);
  });

  // En un pull request el job de la pregunta no arranca, y sin una función de
  // estado Actions saltaría también `compare`: todos los PRs sin visual. Tiene
  // que ser `!cancelled()` y no `always()`: al cancelar una corrida, GitHub no
  // corta un job cuyo `if` sigue dando true.
  it("compare sigue corriendo en pull_request, donde la pregunta no se hace", () => {
    const condition = parseWorkflow().jobs.compare?.if ?? "";

    expect(condition).toMatch(/!cancelled\(\)/);
    expect(condition).not.toMatch(/always\(\)/);
    expect(condition).toMatch(/github\.event_name == 'pull_request'/);
    expect(condition).toMatch(/github\.event_name == 'push'/);
  });

  it("la aceptación a mano no espera a la pregunta", () => {
    expect(parseWorkflow().jobs.accept?.needs ?? []).not.toContain(GATE_JOB);
  });
});

describe("versión de Node y navegadores", () => {
  it.each(["compare", "accept"])(
    "el job %s toma la versión de Node de .nvmrc",
    (jobName) => {
      const setup = stepsOf(jobName).find((step) =>
        step.uses?.startsWith("actions/setup-node"),
      ) as { with?: Record<string, unknown> } | undefined;

      expect(setup?.with?.["node-version-file"]).toBe(".nvmrc");
      expect(setup?.with?.["node-version"]).toBeUndefined();
    },
  );

  it.each(["compare", "accept"])(
    "el job %s instala los navegadores con la acción que los cachea",
    (jobName) => {
      const uses = stepsOf(jobName).map((step) => step.uses);

      expect(uses).toContain("./.github/actions/playwright-browsers");
    },
  );
});
