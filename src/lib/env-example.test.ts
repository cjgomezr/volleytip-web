import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  OPTIONAL_SERVER_ENV_VARIABLES,
  SERVER_ENV_VARIABLES,
} from "./env.server";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ENV_EXAMPLE = ".env.example";
const ASSIGNMENT = /^([A-Z][A-Z0-9_]*)=(.*)$/;
// `git check-ignore` termina con 0 si el archivo está ignorado y con 1 si no.
const GIT_IGNORED_EXIT_CODE = 0;
const GIT_NOT_IGNORED_EXIT_CODE = 1;

interface Assignment {
  readonly name: string;
  readonly value: string;
}

function readAssignments(): Assignment[] {
  return readFileSync(new URL(`../../${ENV_EXAMPLE}`, import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((line) => ASSIGNMENT.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, name = "", value = ""]) => ({ name, value }));
}

function checkIgnoreExitCode(relativePath: string): number | null {
  return spawnSync("git", ["check-ignore", "--quiet", relativePath], {
    cwd: REPO_ROOT,
  }).status;
}

describe(".env.example", () => {
  it("lista exactamente las variables que valida el módulo de entorno", () => {
    const names = readAssignments().map(({ name }) => name);

    expect(names).toEqual([
      ...SERVER_ENV_VARIABLES,
      ...OPTIONAL_SERVER_ENV_VARIABLES,
    ]);
  });

  it("no trae ningún valor", () => {
    const withValue = readAssignments().filter(({ value }) => value !== "");

    expect(withValue).toEqual([]);
  });

  it("git lo deja pasar", () => {
    expect(checkIgnoreExitCode(ENV_EXAMPLE)).toBe(GIT_NOT_IGNORED_EXIT_CODE);
  });

  it("git sigue ignorando .env.local", () => {
    expect(checkIgnoreExitCode(".env.local")).toBe(GIT_IGNORED_EXIT_CODE);
  });
});
