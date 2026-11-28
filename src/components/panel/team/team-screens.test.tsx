import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { buildSampleTeam, type SampleTeamState } from "~/lib/admin/sample-team";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { SampleTeamScreen } from "./sample-team-screen";

// El primer pintado, que es lo que ve quien no tiene JavaScript. El foco se
// prueba en `tests/admin-team.spec.ts`.

function render(state: SampleTeamState, language: Language = "es"): string {
  const screen: ReactElement = (
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <SampleTeamScreen {...buildSampleTeam(state)} />
    </TranslationsProvider>
  );
  const Stub = createRoutesStub([{ path: "*", Component: () => screen }]);
  const path = language === "es" ? "/admin/equipo" : "/en/admin/team";
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

function readRows(html: string): string[] {
  return html.split(/(?=<li data-member-row)/).slice(1);
}

describe("equipo: la pantalla de la lista", () => {
  it("pinta nombre, correo, rol, estado y último ingreso de cada miembro", () => {
    const [first] = readRows(render("lista"));

    expect(first).toContain("Andrés Gómez");
    expect(first).toContain("andres@example.com");
    expect(first).toContain('data-member-role="admin"');
    expect(first).toContain('data-member-active="true"');
    expect(first).toMatch(/<time dateTime="2026-11-27T[^"]+">27\/11\/26/);
  });

  it.each([
    ["es", "Aún no ha entrado"],
    ["en", "Has not signed in yet"],
  ] as const)("en %s dice que alguien nunca ha entrado", (language, text) => {
    const rows = readRows(render("lista", language));

    expect(rows.filter((row) => row.includes(text))).toHaveLength(1);
  });

  it("a quien mira no le ofrece cambiarse el rol ni desactivarse", () => {
    const [self, other] = readRows(render("lista"));

    expect(self).not.toMatch(/<button|<a /);
    expect(self).toContain("Eres tú");
    expect(other).toContain("Pasar a staff");
    expect(other).toContain(">Desactivar</a>");
  });

  it("a un desactivado le ofrece activarlo y no desactivarlo", () => {
    const row = readRows(render("lista")).find((candidate) =>
      candidate.includes('data-member-active="false"'),
    );

    expect(row).toContain('aria-label="Activar a Lina Paz"');
    expect(row).not.toContain("Desactivar a Lina Paz");
  });

  it.each(["es", "en"] as const)(
    "en %s no ofrece borrar a nadie (DR-006)",
    (language) => {
      expect(render("lista", language)).not.toMatch(
        /Borrar|Eliminar|Delete|Remove/,
      );
    },
  );

  it("explica el rechazo del último admin en su fila", () => {
    const rejected = readRows(render("rechazo")).filter((row) =>
      row.includes('role="alert"'),
    );

    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toContain("es el último admin activo");
  });

  it("tras invitar dice que no se envió correo y dónde pide el enlace", () => {
    expect(render("invitada")).toContain(
      "No se envió ningún correo: avísale que entre en /admin/entrar y pida su enlace.",
    );
  });
});

describe("equipo: la pantalla de invitar", () => {
  it("pone cada error junto a su campo y conserva lo escrito", () => {
    const html = render("errores");

    expect(html.match(/aria-invalid="true"/g)).toHaveLength(2);
    expect(html).toContain("Escribe el nombre.");
    expect(html).toContain("Escribe un correo válido.");
    expect(html).toContain('value="nora@"');
  });

  it("dice que el correo ya es del equipo y que no cambió nada", () => {
    expect(render("ya-esta")).toContain(
      "andres@example.com ya es del equipo. No se cambió nada.",
    );
  });
});

describe("equipo: la confirmación de desactivar", () => {
  it("pide confirmar, con cancelar a la lista", () => {
    const html = render("confirmar");

    expect(html).toContain("¿Desactivar a Sara Ruiz (sara@example.com)?");
    expect(html).toContain('name="confirm" value="yes"');
    expect(html).toContain('href="/admin/equipo"');
    expect(html).not.toContain('role="alert"');
  });

  it("explica por qué la base no dejó desactivar al último admin", () => {
    const html = render("ultimo-admin");

    expect(html).toContain('role="alert"');
    expect(html).toContain("es el último admin activo");
  });
});
