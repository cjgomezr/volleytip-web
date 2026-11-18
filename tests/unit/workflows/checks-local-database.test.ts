import { readFileSync } from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/checks.yml");

const START_DATABASE_COMMAND = "npm run db:start";
const TESTS_STEP_NAME = "Tests";
const RUN_INTEGRATION_TESTS_ENV = "RUN_INTEGRATION_TESTS";
/** La misma condición que decide `RUN_INTEGRATION_TESTS` en el paso `Tests`:
 * un PR de solo texto no corre pruebas de integración, así que tampoco paga
 * por levantar la base. */
const NOT_TEXT_ONLY_CONDITION = "steps.texto.outputs.solo_texto != 'true'";
const BOOTSTRAPPED_CONDITION = "steps.repo.outputs.bootstrapped == 'true'";

interface WorkflowStep {
  name?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
}

interface WorkflowFile {
  jobs: Record<string, { steps: WorkflowStep[] }>;
}

function readChecksSteps(): WorkflowStep[] {
  const workflow = load(readFileSync(WORKFLOW_PATH, "utf8")) as WorkflowFile;
  const job = workflow.jobs.checks;
  if (job === undefined) {
    throw new Error("checks.yml no tiene el job `checks`");
  }
  return job.steps;
}

function findStartDatabaseIndex(steps: WorkflowStep[]): number {
  return steps.findIndex((step) => step.run?.includes(START_DATABASE_COMMAND));
}

function findTestsIndex(steps: WorkflowStep[]): number {
  return steps.findIndex((step) => step.name === TESTS_STEP_NAME);
}

describe("checks.yml: base local de Supabase", () => {
  it("el job checks levanta la base local", () => {
    expect(findStartDatabaseIndex(readChecksSteps())).toBeGreaterThanOrEqual(0);
  });

  it("la levanta antes del paso Tests", () => {
    const steps = readChecksSteps();

    expect(findTestsIndex(steps)).toBeGreaterThanOrEqual(0);
    expect(findStartDatabaseIndex(steps)).toBeLessThan(findTestsIndex(steps));
  });

  it("no la levanta en un PR de solo texto", () => {
    const steps = readChecksSteps();
    const startDatabase = steps[findStartDatabaseIndex(steps)];

    expect(startDatabase?.if).toContain(NOT_TEXT_ONLY_CONDITION);
    expect(startDatabase?.if).toContain(BOOTSTRAPPED_CONDITION);
  });

  it("usa la misma condición de solo texto que decide RUN_INTEGRATION_TESTS", () => {
    const steps = readChecksSteps();
    const tests = steps[findTestsIndex(steps)];

    expect(tests?.env?.[RUN_INTEGRATION_TESTS_ENV]).toContain(
      NOT_TEXT_ONLY_CONDITION,
    );
  });

  it("un fallo al levantarla detiene el job en vez de seguir sin base", () => {
    const steps = readChecksSteps();
    const startDatabase = steps[findStartDatabaseIndex(steps)];

    expect(startDatabase?.["continue-on-error"]).toBeUndefined();
  });
});
