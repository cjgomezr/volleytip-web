import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/migrations.yml");
const ENVIRONMENTS_DOC_PATH = path.join(REPO_ROOT, "docs/entornos.md");
const CHECK_SECRETS_SCRIPT = "scripts/check-required-secrets.sh";

const SECRETS_JOB = "secretos";
const DEV_JOB = "pruebas";
const PROD_JOB = "produccion";

const ACCESS_TOKEN_SECRET = "SUPABASE_ACCESS_TOKEN";
const DEV_SECRETS = ["SUPABASE_DEV_PROJECT_REF", "SUPABASE_DEV_DB_PASSWORD"];
const PROD_SECRETS = ["SUPABASE_PROD_PROJECT_REF", "SUPABASE_PROD_DB_PASSWORD"];
/** Los nombres los fija el ticket #29. */
const WORKFLOW_SECRETS = [ACCESS_TOKEN_SECRET, ...DEV_SECRETS, ...PROD_SECRETS];

/** `--yes` porque en CI nadie contesta la confirmación, y la entrada cerrada
 * para que la CLI no se quede esperando una respuesta. La contraseña va con
 * `--password`: con una referencia suelta en `--remote`, la CLI ignora la
 * variable SUPABASE_DB_PASSWORD. */
const PUSH_COMMAND =
  'npx supabase db push --yes --remote="$PROJECT_REF" --password "$DB_PASSWORD" < /dev/null';

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
}

interface WorkflowJob {
  if?: string;
  needs?: string[];
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
  steps: WorkflowStep[];
}

interface WorkflowFile {
  on: Record<string, { branches?: string[]; paths?: string[] } | null>;
  permissions: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress"?: boolean };
  jobs: Record<string, WorkflowJob>;
}

function readWorkflowSource(): string {
  return readFileSync(WORKFLOW_PATH, "utf8");
}

function readWorkflow(): WorkflowFile {
  return load(readWorkflowSource()) as WorkflowFile;
}

function readJob(name: string): WorkflowJob {
  const job = readWorkflow().jobs[name];
  if (job === undefined) {
    throw new Error(`migrations.yml no tiene el job \`${name}\``);
  }
  return job;
}

function findPushStep(jobName: string): WorkflowStep {
  const step = readJob(jobName).steps.find(
    (candidate) => candidate.run?.trim() === PUSH_COMMAND,
  );
  if (step === undefined) {
    throw new Error(`El job \`${jobName}\` no aplica las migraciones`);
  }
  return step;
}

function findCheckSecretsStep(): WorkflowStep {
  const step = readJob(SECRETS_JOB).steps.find((candidate) =>
    candidate.run?.includes(CHECK_SECRETS_SCRIPT),
  );
  if (step === undefined) {
    throw new Error(`El job \`${SECRETS_JOB}\` no comprueba los secretos`);
  }
  return step;
}

function secretsReferencedIn(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]),
    ),
  ].filter((name): name is string => name !== undefined);
}

function secretExpression(name: string): string {
  return `\${{ secrets.${name} }}`;
}

interface ScriptResult {
  status: number | null;
  output: string;
}

function runCheckSecrets(
  names: readonly string[],
  values: Record<string, string>,
): ScriptResult {
  const result = spawnSync("bash", [CHECK_SECRETS_SCRIPT, ...names], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...values },
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("migrations.yml: disparadores", () => {
  it("solo se dispara con un push", () => {
    expect(Object.keys(readWorkflow().on)).toEqual(["push"]);
  });

  it("solo con un push a main", () => {
    expect(readWorkflow().on.push?.branches).toEqual(["main"]);
  });

  it("corre aunque el merge no traiga migraciones: no filtra por rutas", () => {
    expect(readWorkflow().on.push?.paths).toBeUndefined();
  });
});

describe("migrations.yml: orden", () => {
  it("producción depende de pruebas", () => {
    expect(readJob(PROD_JOB).needs).toContain(DEV_JOB);
  });

  it("pruebas depende de la comprobación de secretos", () => {
    expect(readJob(DEV_JOB).needs).toContain(SECRETS_JOB);
  });

  // Un `if` con `always()` o `!cancelled()` dejaría correr el job aunque su
  // dependencia hubiera fallado.
  it("ningún job lleva una condición propia", () => {
    const jobs = Object.values(readWorkflow().jobs);

    expect(jobs.map((job) => job.if)).toEqual(jobs.map(() => undefined));
  });

  it("ningún job ni paso sigue adelante después de un error", () => {
    const jobs = Object.values(readWorkflow().jobs);
    const flags = jobs.flatMap((job) => [
      job["continue-on-error"],
      ...job.steps.map((step) => step["continue-on-error"]),
    ]);

    expect(flags.filter((flag) => flag !== undefined)).toEqual([]);
  });

  it("los dos jobs aplican las migraciones con el mismo comando", () => {
    expect(findPushStep(DEV_JOB).run?.trim()).toBe(PUSH_COMMAND);
    expect(findPushStep(PROD_JOB).run?.trim()).toBe(PUSH_COMMAND);
  });

  // Sin `supabase link`, la CLI no lee la contraseña de SUPABASE_DB_PASSWORD:
  // el secreto quedaría sin usar y nadie lo notaría.
  it("la contraseña llega por --password y no por la variable que la CLI ignora", () => {
    const steps = [findPushStep(DEV_JOB), findPushStep(PROD_JOB)];

    for (const step of steps) {
      expect(step.run).toContain('--password "$DB_PASSWORD"');
      expect(Object.keys(step.env ?? {})).not.toContain("SUPABASE_DB_PASSWORD");
    }
  });

  it("pruebas apunta a volleytip-dev y no conoce los secretos de producción", () => {
    const step = findPushStep(DEV_JOB);

    expect(step.env).toEqual({
      SUPABASE_ACCESS_TOKEN: secretExpression(ACCESS_TOKEN_SECRET),
      PROJECT_REF: secretExpression("SUPABASE_DEV_PROJECT_REF"),
      DB_PASSWORD: secretExpression("SUPABASE_DEV_DB_PASSWORD"),
    });
    expect(secretsReferencedIn(JSON.stringify(readJob(DEV_JOB)))).not.toEqual(
      expect.arrayContaining(PROD_SECRETS),
    );
  });

  it("producción apunta a volleytip-prod y no conoce los secretos de pruebas", () => {
    const step = findPushStep(PROD_JOB);

    expect(step.env).toEqual({
      SUPABASE_ACCESS_TOKEN: secretExpression(ACCESS_TOKEN_SECRET),
      PROJECT_REF: secretExpression("SUPABASE_PROD_PROJECT_REF"),
      DB_PASSWORD: secretExpression("SUPABASE_PROD_DB_PASSWORD"),
    });
    expect(secretsReferencedIn(JSON.stringify(readJob(PROD_JOB)))).not.toEqual(
      expect.arrayContaining(DEV_SECRETS),
    );
  });

  it("ningún secreto se escribe dentro de un comando", () => {
    const commands = Object.values(readWorkflow().jobs)
      .flatMap((job) => job.steps)
      .map((step) => step.run ?? "");

    // Una expresión `${{ ... }}` en un `run` se sustituye antes de ejecutar:
    // el valor quedaría escrito en el comando.
    expect(commands.filter((command) => command.includes("${{"))).toEqual([]);
  });
});

describe("migrations.yml: secretos", () => {
  it("el workflow usa exactamente los cinco secretos del ticket", () => {
    expect(secretsReferencedIn(readWorkflowSource()).sort()).toEqual(
      [...WORKFLOW_SECRETS].sort(),
    );
  });

  it("el job de secretos no depende de nadie y no aplica migraciones", () => {
    const job = readJob(SECRETS_JOB);

    expect(job.needs).toBeUndefined();
    expect(job.steps.filter((step) => step.run?.includes("supabase"))).toEqual(
      [],
    );
  });

  it("comprueba los cinco secretos, los de producción incluidos", () => {
    const step = findCheckSecretsStep();

    expect(step.run?.trim()).toBe(
      `bash ${CHECK_SECRETS_SCRIPT} ${WORKFLOW_SECRETS.join(" ")}`,
    );
    expect(step.env).toEqual(
      Object.fromEntries(
        WORKFLOW_SECRETS.map((name) => [name, secretExpression(name)]),
      ),
    );
  });

  it("con todos los secretos puestos, la comprobación pasa", () => {
    const values = Object.fromEntries(
      WORKFLOW_SECRETS.map((name) => [name, `valor-de-${name}`]),
    );

    expect(runCheckSecrets(WORKFLOW_SECRETS, values).status).toBe(0);
  });

  it.each(WORKFLOW_SECRETS)("si falta %s, falla y lo nombra", (missing) => {
    const values = Object.fromEntries(
      WORKFLOW_SECRETS.filter((name) => name !== missing).map((name) => [
        name,
        `valor-de-${name}`,
      ]),
    );

    const result = runCheckSecrets(WORKFLOW_SECRETS, values);

    expect(result.status).toBe(1);
    expect(result.output).toContain(missing);
  });

  it("un secreto vacío cuenta como faltante", () => {
    const values = Object.fromEntries(
      WORKFLOW_SECRETS.map((name) => [name, `valor-de-${name}`]),
    );

    const result = runCheckSecrets(WORKFLOW_SECRETS, {
      ...values,
      SUPABASE_PROD_DB_PASSWORD: "",
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("SUPABASE_PROD_DB_PASSWORD");
  });

  it("si faltan varios, los nombra todos de una vez", () => {
    const result = runCheckSecrets(WORKFLOW_SECRETS, {
      SUPABASE_ACCESS_TOKEN: "valor-del-token",
    });

    expect(result.status).toBe(1);
    for (const name of [...DEV_SECRETS, ...PROD_SECRETS]) {
      expect(result.output).toContain(name);
    }
    expect(result.output).not.toContain(`secreto ${ACCESS_TOKEN_SECRET}`);
  });

  it("nunca imprime el valor de un secreto, ni al pasar ni al fallar", () => {
    const values = Object.fromEntries(
      WORKFLOW_SECRETS.map((name) => [name, `valor-de-${name}`]),
    );
    const withOneMissing = { ...values, SUPABASE_DEV_DB_PASSWORD: "" };

    const passing = runCheckSecrets(WORKFLOW_SECRETS, values);
    const failing = runCheckSecrets(WORKFLOW_SECRETS, withOneMissing);

    expect(passing.output).not.toContain("valor-de-");
    expect(failing.output).not.toContain("valor-de-");
  });

  it("llamado sin nombres falla en vez de pasar sin comprobar nada", () => {
    expect(runCheckSecrets([], {}).status).not.toBe(0);
  });
});

describe("migrations.yml: concurrencia", () => {
  it("una corrida nunca se cancela a mitad", () => {
    expect(readWorkflow().concurrency?.["cancel-in-progress"]).toBe(false);
  });

  // Un grupo que dependiera del commit o de la corrida dejaría que dos
  // corridas aplicaran migraciones a la vez.
  it("todas las corridas comparten un solo grupo", () => {
    const group = readWorkflow().concurrency?.group;

    expect(group).toBe("migrations");
  });

  it("ningún job define otra concurrencia", () => {
    const jobs = Object.values(readWorkflow().jobs);

    expect(jobs.filter((job) => "concurrency" in job)).toEqual([]);
  });
});

describe("migrations.yml: permisos", () => {
  it("el workflow pide solo contents: read", () => {
    expect(readWorkflow().permissions).toEqual({ contents: "read" });
  });

  it("ningún job amplía los permisos", () => {
    const jobs = Object.values(readWorkflow().jobs);

    expect(jobs.filter((job) => job.permissions !== undefined)).toEqual([]);
  });
});

describe("docs/entornos.md", () => {
  it.each(WORKFLOW_SECRETS)("nombra el secreto %s", (name) => {
    expect(readFileSync(ENVIRONMENTS_DOC_PATH, "utf8")).toContain(
      `\`${name}\``,
    );
  });

  it("ya no deja la sección de secretos como pendiente", () => {
    expect(readFileSync(ENVIRONMENTS_DOC_PATH, "utf8")).not.toContain(
      "Pendiente: los lista el ticket #29.",
    );
  });
});
