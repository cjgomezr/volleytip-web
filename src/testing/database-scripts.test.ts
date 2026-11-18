import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DATABASE_SCRIPTS = {
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
} as const;

interface PackageManifest {
  readonly scripts?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

function resolveRepoPath(relativePath: string): URL {
  return new URL(`../../${relativePath}`, import.meta.url);
}

function readManifest(): PackageManifest {
  return JSON.parse(
    readFileSync(resolveRepoPath("package.json"), "utf8"),
  ) as PackageManifest;
}

describe("scripts de base de datos", () => {
  it.each(Object.entries(DATABASE_SCRIPTS))(
    "package.json declara %s como %j",
    (scriptName, command) => {
      expect(readManifest().scripts?.[scriptName]).toBe(command);
    },
  );

  it("Supabase CLI es una dependencia de desarrollo con versión exacta", () => {
    expect(readManifest().devDependencies?.supabase).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("Supabase en el repo", () => {
  it.each(["supabase/config.toml", "supabase/migrations"])(
    "existe %s",
    (relativePath) => {
      expect(existsSync(resolveRepoPath(relativePath))).toBe(true);
    },
  );
});
