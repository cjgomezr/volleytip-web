import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

// Las líneas de una sección de un TOML, sin los comentarios.
function readTomlSection(toml: string, name: string): string[] {
  const lines = toml.split(/\r?\n/);
  const start = lines.indexOf(`[${name}]`);
  if (start === -1) return [];
  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => line.startsWith("["));
  return after
    .slice(0, end === -1 ? undefined : end)
    .filter((line) => line !== "" && !line.startsWith("#"));
}

describe("google: la base local", () => {
  const config = readRepoFile("supabase/config.toml");

  it("queda apagado y lee las credenciales de variables de entorno", () => {
    expect(readTomlSection(config, "auth.external.google")).toEqual(
      expect.arrayContaining([
        "enabled = false",
        'client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"',
        'secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"',
        "skip_nonce_check = false",
      ]),
    );
  });

  it("el registro público sigue apagado", () => {
    expect(readTomlSection(config, "auth")).toContain("enable_signup = false");
  });
});

describe("google: docs/entornos.md", () => {
  const [, section = ""] = readRepoFile("docs/entornos.md").split(
    "### Entrar con Google",
  );

  it.each([
    "Google Cloud",
    "https://<identificador-de-volleytip-dev>.supabase.co/auth/v1/callback",
    "https://<identificador-de-volleytip-prod>.supabase.co/auth/v1/callback",
    "http://127.0.0.1:54321/auth/v1/callback",
    "Authentication → Sign In / Providers → Google",
    "GOOGLE_SIGN_IN_ENABLED",
    "SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED",
    "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
    "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET",
    "Allow new users to sign up",
  ])("la sección de Google explica %s", (expected) => {
    expect(section).toContain(expected);
  });
});
