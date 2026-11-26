import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { ADMIN_MODULES, type AdminModule } from "~/lib/admin/modules";
import { SAMPLE_MODULES } from "~/lib/admin/sample-modules";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import PanelMemberLayout from "~/routes/panel/member-layout";

import { PanelMore } from "./panel-more";
import { PanelShell, type PanelShellProps } from "./panel-shell";

type ShellOptions = Omit<PanelShellProps, "children">;

interface RenderOptions extends Partial<ShellOptions> {
  readonly language?: Language;
  readonly path?: string;
  readonly isMore?: boolean;
}

function render({
  language = "es",
  path = "/admin",
  isMore = false,
  ...overrides
}: RenderOptions = {}): string {
  const shell: ShellOptions = {
    modules: ADMIN_MODULES,
    member: { displayName: "Andrés Gómez", role: "admin" },
    pendingCounts: {},
    isMaintenanceOn: false,
    morePath: language === "es" ? "/admin/mas" : "/en/admin/more",
    languageAction: language === "es" ? "/admin/idioma" : "/en/admin/language",
    ...overrides,
  };
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          <PanelShell {...shell}>
            {isMore ? <PanelMore /> : <p>contenido</p>}
          </PanelShell>
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

/** El pedazo del documento que pinta una región de la cáscara. */
function region(html: string, name: string): string {
  const found = new RegExp(
    `<(\\w+)[^>]*data-panel-region="${name}"[^>]*>`,
  ).exec(html);
  if (found === null) throw new Error(`No está la región "${name}"`);
  const [opening, tag] = found;
  // Ninguna región anida otra etiqueta como la suya.
  const end = html.indexOf(`</${tag}>`, found.index + opening.length);
  return html.slice(found.index, end);
}

function linkTags(html: string): string[] {
  return [...html.matchAll(/<a\s[^>]*>/g)].map(([tag]) => tag);
}

function currentHrefs(html: string, current = "page"): string[] {
  return linkTags(html)
    .filter((tag) => tag.includes(`aria-current="${current}"`))
    .map((tag) => /href="([^"]*)"/.exec(tag)?.[1] ?? "");
}

const SAMPLE = {
  modules: SAMPLE_MODULES,
  pendingCounts: { "sample-messages": 3 },
  morePath: "/dev/panel/mas",
  path: "/dev/panel",
} as const;

const SAMPLE_MORE = { ...SAMPLE, path: "/dev/panel/mas", isMore: true };

describe("cáscara del panel", () => {
  it("pinta el menú lateral con todos los módulos de la lista", () => {
    const sidebar = region(render(SAMPLE), "sidebar-nav");

    expect(linkTags(sidebar)).toHaveLength(SAMPLE_MODULES.length);
    expect(sidebar.indexOf("Resumen")).toBeLessThan(
      sidebar.indexOf("Mensajes"),
    );
    expect(sidebar.indexOf("Mensajes")).toBeLessThan(
      sidebar.indexOf("Bitácora"),
    );
  });

  it("la barra inferior tiene los módulos marcados y 'Más'", () => {
    const bar = region(render(SAMPLE), "bottom-bar");

    expect(linkTags(bar)).toHaveLength(3);
    for (const text of ["Resumen", "Mensajes", "Más"]) {
      expect(bar).toContain(text);
    }
    expect(bar).not.toContain("Equipo");
  });

  it("agregar una sección es agregar un módulo", () => {
    const extra: AdminModule = {
      id: "extra",
      page: { id: "extra", file: "x", path: "admin/extra" },
      labelKey: "panel.sample.team",
      requiredRole: "admin",
    };

    const html = render({ modules: [...ADMIN_MODULES, extra] });

    expect(region(html, "sidebar-nav")).toContain('href="/admin/extra"');
  });

  it("el menú lateral va sobre brand-night y desaparece en celular", () => {
    const sidebar = /<aside[^>]*>/.exec(render())?.[0] ?? "";

    expect(sidebar).toContain("bg-brand-night");
    expect(sidebar).toContain("hidden");
    expect(sidebar).toContain("md:flex");
  });

  it("la barra inferior es fija abajo y solo de celular", () => {
    const bar = region(render(), "bottom-bar");

    expect(bar).toContain("md:hidden");
    expect(bar).toContain("sticky bottom-0");
  });

  it("marca el módulo actual con aria-current en el menú y la barra", () => {
    const html = render({ ...SAMPLE, path: "/dev/panel/mensajes" });

    expect(currentHrefs(html)).toEqual([
      "/dev/panel/mensajes",
      "/dev/panel/mensajes",
    ]);
  });

  it("en la página 'Más', la entrada actual es 'Más'", () => {
    expect(currentHrefs(render(SAMPLE_MORE))).toEqual(["/dev/panel/mas"]);
  });

  it("en un módulo que está dentro de 'Más', 'Más' queda marcado", () => {
    const html = render({ ...SAMPLE, path: "/dev/panel/equipo" });

    expect(currentHrefs(region(html, "bottom-bar"), "true")).toEqual([
      "/dev/panel/mas",
    ]);
  });

  it("muestra el número pendiente en la entrada del módulo", () => {
    const html = render(SAMPLE);

    expect(region(html, "sidebar-nav")).toContain("3 pendientes");
    expect(region(html, "bottom-bar")).toContain("3 pendientes");
  });

  it("suma en 'Más' lo pendiente de los módulos que guarda", () => {
    const modules = SAMPLE_MODULES.map((module) => ({
      ...module,
      bottomBar: undefined,
    }));

    const html = render({ ...SAMPLE, modules });

    expect(region(html, "bottom-bar")).toContain("3 pendientes");
  });

  it("no muestra nada cuando el contador es cero", () => {
    const html = render({
      ...SAMPLE,
      pendingCounts: { "sample-messages": 0 },
    });

    expect(html).not.toContain("pendiente");
  });

  it("muestra el nombre y el rol de quien entró", () => {
    const html = render();

    expect(html).toContain("Andrés Gómez");
    expect(html).toContain("Administrador");
  });

  it("sin nombre muestra el correo", () => {
    const email = "andres@prueba.volleytip.test";

    const html = render({ member: { displayName: email, role: "admin" } });

    expect(html).toContain(email);
  });

  it("avisa el modo mantenimiento con una franja", () => {
    const html = render({ isMaintenanceOn: true });

    expect(region(html, "maintenance")).toContain(
      "modo mantenimiento está encendido",
    );
  });

  it("sin mantenimiento no hay franja", () => {
    expect(render()).not.toContain('data-panel-region="maintenance"');
  });

  it("cierra sesión con la acción que ya existe", () => {
    expect(render()).toContain('action="/admin/salir"');
    expect(render({ language: "en", path: "/en/admin" })).toContain(
      'action="/en/admin/sign-out"',
    );
  });

  it("'Más' lista lo que no está en la barra y 'Cerrar sesión'", () => {
    const html = render(SAMPLE_MORE);

    const list = region(html, "more-list");
    expect(list).toContain("Equipo");
    expect(list).toContain("Bitácora");
    expect(list).not.toContain("Resumen");
    expect(list).not.toContain("Mensajes");
    expect(region(html, "more")).toContain("Cerrar sesión");
  });

  it("'Más' sin módulos fuera de la barra solo ofrece cerrar sesión", () => {
    const html = render({
      modules: ADMIN_MODULES.filter(({ bottomBar }) => bottomBar),
      path: "/admin/mas",
      isMore: true,
    });

    expect(html).not.toContain('data-panel-region="more-list"');
    expect(region(html, "more")).toContain("Cerrar sesión");
  });
});

describe("idioma del panel: selector", () => {
  it("envía la pantalla actual a la acción del idioma", () => {
    const html = render({ path: "/admin/mas?x=1" });

    expect(html).toContain('action="/admin/idioma"');
    expect(html).toContain('name="from" value="/admin/mas?x=1"');
    expect(html).toContain('value="en"');
  });

  it("marca el idioma de la página", () => {
    const html = render({ language: "en", path: "/en/admin" });

    expect(html).toMatch(/<button[^>]*value="en"[^>]*aria-current="true"/);
    expect(html).not.toMatch(/<button[^>]*value="es"[^>]*aria-current/);
  });
});

describe("datos de la ruta en la cáscara", () => {
  it("el layout real le pasa el mantenimiento y la persona", () => {
    const loaderData = {
      view: "admin",
      member: { displayName: "Ana", role: "admin" },
      pendingCounts: {},
      isMaintenanceOn: true,
    } as const;
    const Stub = createRoutesStub([
      {
        path: "*",
        Component: () => (
          <TranslationsProvider language="es" messages={getMessages("es")}>
            <PanelMemberLayout
              {...({ loaderData } as unknown as Parameters<
                typeof PanelMemberLayout
              >[0])}
            />
          </TranslationsProvider>
        ),
      },
    ]);

    const html = renderToStaticMarkup(<Stub initialEntries={["/admin"]} />);

    expect(html).toContain('data-panel-region="maintenance"');
    expect(html).toContain("Ana");
  });
});

describe("textos del panel en la cáscara", () => {
  it("sale en inglés bajo /en/", () => {
    const html = render({
      ...SAMPLE,
      language: "en",
      path: "/en/dev/panel",
      morePath: "/en/dev/panel/more",
    });

    for (const text of ["Overview", "Messages", "More", "Sign out"]) {
      expect(html).toContain(text);
    }
    for (const text of ["Resumen", "Mensajes", "Cerrar sesión"]) {
      expect(html).not.toContain(text);
    }
  });
});
