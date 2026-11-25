import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

// Donde viviría el correo de alguien del equipo: el dominio propio o un
// proveedor personal.
const TEAM_OR_PERSONAL_EMAIL =
  "[A-Za-z0-9._%+-]+@(volleytip\\.com|gmail\\.com|googlemail\\.com|hotmail\\.[a-z]+|outlook\\.[a-z]+|live\\.com|yahoo\\.[a-z.]+|icloud\\.com|proton\\.me|protonmail\\.com)";

// El buzón público del sitio y los correos inventados de maquetas y pruebas.
// Un correo nuevo aquí tiene que no ser de nadie del equipo.
const ALLOWED_EMAILS: readonly string[] = [
  "team@volleytip.com",
  "tu@volleytip.com",
  "ana@volleytip.com",
  "juan@gmail.com",
  "juanperez@gmail.com",
];

/** Las direcciones que aparecen en los archivos del repositorio, los nuevos
 * sin confirmar incluidos. */
function findRepositoryEmails(): string[] {
  const result = spawnSync(
    "git",
    [
      "grep",
      "--untracked",
      "-I",
      "-h",
      "-o",
      "-i",
      "-E",
      TEAM_OR_PERSONAL_EMAIL,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`\`git grep\` falló: ${result.stderr}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .filter((line) => line !== "")
    .map((line) => line.toLowerCase());
}

describe("correos en el repositorio", () => {
  it("la búsqueda encuentra el buzón público", () => {
    expect(findRepositoryEmails()).toContain("team@volleytip.com");
  });

  it("no hay ningún correo del equipo", () => {
    const unexpected = findRepositoryEmails().filter(
      (email) => !ALLOWED_EMAILS.includes(email),
    );

    expect(unexpected).toEqual([]);
  });
});
