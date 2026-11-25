import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";

const TEMPLATE_PATH = "supabase/templates/magic_link.html";

function readText(path: string): string {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function readSection(name: string): string {
  const [, rest = ""] = readText("supabase/config.toml").split(`\n[${name}]\n`);
  return rest.split("\n[")[0] ?? "";
}

describe("entrada: correo del enlace", () => {
  const section = readSection("auth.email.template.magic_link");

  it("la base local usa la plantilla del repositorio", () => {
    expect(section).toContain(`content_path = "./${TEMPLATE_PATH}"`);
  });

  it("el asunto va en español y en inglés", () => {
    expect(section).toMatch(/subject = ".*entrar.*sign-in.*"/i);
  });

  it.each(SUPPORTED_LANGUAGES.map(({ code }) => code))(
    "enlaza a la página del sitio en %s con el token y la página pedida",
    (language) => {
      const template = readText(TEMPLATE_PATH);
      const path = getPanelPath("adminSignInLink", language);

      expect(template).toContain(
        `href="{{ .SiteURL }}${path}?token_hash={{ .TokenHash }}&next={{ .RedirectTo }}"`,
      );
      expect(template).toContain(`lang="${language}"`);
    },
  );

  it("no apunta a la dirección de Supabase", () => {
    const template = readText(TEMPLATE_PATH);

    expect(template).not.toContain("ConfirmationURL");
    expect(template).not.toContain("supabase.co");
  });
});

describe("entrada: pasos en los proyectos alojados", () => {
  const guide = readText("docs/entornos.md");

  it.each([
    "smtp.resend.com",
    TEMPLATE_PATH,
    "Redirect URLs",
    "Site URL",
    "Allow new users to sign up",
  ])("docs/entornos.md explica %s", (step) => {
    expect(guide).toContain(step);
  });
});
