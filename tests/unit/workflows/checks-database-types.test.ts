import { readFileSync } from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/checks.yml");

const START_DATABASE_COMMAND = "npm run db:start";
const CHECK_TYPES_COMMAND = "npm run db:types:check";
/** La misma condición del paso que levanta la base: en un PR de solo texto no
 * hay base local, así que el chequeo no puede correr. */
const NOT_TEXT_ONLY_CONDITION = "steps.texto.outputs.solo_texto != 'true'";
const BOOTSTRAPPED_CONDITION = "steps.repo.outputs.bootstrapped == 'true'";

interface WorkflowStep {
  name?: string;
  run?: string;
  if?: string;
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

function findStepIndex(steps: WorkflowStep[], command: string): number {
  return steps.findIndex((step) => step.run?.trim() === command);
}

describe("checks.yml: tipos de la base", () => {
  it("el job checks comprueba que los tipos de la base estén al día", () => {
    expect(
      findStepIndex(readChecksSteps(), CHECK_TYPES_COMMAND),
    ).toBeGreaterThanOrEqual(0);
  });

  it("lo comprueba después de levantar la base local", () => {
    const steps = readChecksSteps();

    expect(findStepIndex(steps, START_DATABASE_COMMAND)).toBeGreaterThanOrEqual(
      0,
    );
    expect(findStepIndex(steps, CHECK_TYPES_COMMAND)).toBeGreaterThan(
      findStepIndex(steps, START_DATABASE_COMMAND),
    );
  });

  it("usa la misma condición que el paso que levanta la base", () => {
    const steps = readChecksSteps();
    const startDatabase = steps[findStepIndex(steps, START_DATABASE_COMMAND)];
    const checkTypes = steps[findStepIndex(steps, CHECK_TYPES_COMMAND)];

    expect(checkTypes?.if).toBe(startDatabase?.if);
    expect(checkTypes?.if).toContain(NOT_TEXT_ONLY_CONDITION);
    expect(checkTypes?.if).toContain(BOOTSTRAPPED_CONDITION);
  });

  it("un fallo del chequeo detiene el job", () => {
    const steps = readChecksSteps();
    const checkTypes = steps[findStepIndex(steps, CHECK_TYPES_COMMAND)];

    expect(checkTypes?.["continue-on-error"]).toBeUndefined();
  });
});
