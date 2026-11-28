import type { RouteConfigEntry } from "@react-router/dev/routes";
import { describe, expect, it } from "vitest";

import { isPanelPath } from "~/lib/i18n/panel-pages";
import { isAdminAction } from "~/lib/panel/admin-action.server";
import routes from "~/routes";

const PANEL_LAYOUT = "routes/panel/session-layout.tsx";
const PANEL_FOLDER = "routes/panel/";

// La lista es corta a propósito. Entra aquí solo un `action` que no escribe
// nada que la bitácora deba contar, con la razón al lado.
const ACTIONS_WITHOUT_AUDIT: Readonly<Record<string, string>> = {
  "routes/panel/sign-out.tsx":
    "Cerrar sesión no cambia datos del sitio, y el staff, que no pasa por la pieza, también tiene que poder salir.",
  "routes/panel/sign-in.tsx":
    "Pedir el enlace no cambia datos del sitio, y quien lo pide todavía no es admin.",
  "routes/panel/sign-in-link.tsx":
    "Canjear el enlace abre la sesión y no cambia datos del sitio; antes de canjear no hay actor.",
  "routes/panel/sign-in-google.tsx":
    "Ir a Google no cambia datos del sitio, y quien lo pide todavía no tiene sesión.",
  "routes/panel/missing.tsx":
    "El comodín del panel no escribe nada: su action solo responde 404.",
};

type RouteModule = Readonly<Record<string, unknown>>;

// Todos los módulos de `src/`, por su ruta desde `src/`, como los nombra
// `src/routes.ts`.
const loadersByFile = Object.fromEntries(
  Object.entries(
    import.meta.glob<RouteModule>([
      "/src/**/*.{ts,tsx}",
      "!/src/**/*.test.{ts,tsx}",
    ]),
  ).map(([key, load]) => [key.replace("/src/", ""), load]),
);

function listTreeFiles(entry: RouteConfigEntry): string[] {
  return [entry.file, ...(entry.children ?? []).flatMap(listTreeFiles)];
}

/** Los archivos de rutas del panel que declara `entries`: lo que cuelga de su
 * layout, lo que viva en su carpeta y lo que responda en una dirección del
 * panel. */
function listDeclaredPanelFiles(
  entries: readonly RouteConfigEntry[],
  parentPath = "",
): string[] {
  return entries.flatMap((entry): string[] => {
    if (entry.file === PANEL_LAYOUT) return listTreeFiles(entry);
    const path = [parentPath, entry.path].filter(Boolean).join("/");
    const nested = listDeclaredPanelFiles(entry.children ?? [], path);
    return entry.file.startsWith(PANEL_FOLDER) || isPanelPath(`/${path}`)
      ? [entry.file, ...nested]
      : nested;
  });
}

function listPanelFiles(): string[] {
  const inFolder = Object.keys(loadersByFile).filter((file) =>
    file.startsWith(PANEL_FOLDER),
  );
  return [...new Set([...listDeclaredPanelFiles(routes), ...inFolder])];
}

/** Los archivos que exportan una `action` que no salió de la pieza y que no
 * están en la lista de excepciones. */
function findUnauditedActions(
  modules: Readonly<Record<string, RouteModule>>,
): string[] {
  return Object.entries(modules)
    .filter(
      ([file, module]) =>
        module.action !== undefined &&
        !isAdminAction(module.action) &&
        !(file in ACTIONS_WITHOUT_AUDIT),
    )
    .map(([file]) => file);
}

async function loadModules(
  files: readonly string[],
): Promise<Record<string, RouteModule>> {
  const loaded = await Promise.all(
    files.map(async (file) => {
      const load = loadersByFile[file];
      if (load === undefined) {
        throw new Error(`No se encontró el archivo de la ruta ${file}`);
      }
      return [file, await load()] as const;
    }),
  );
  return Object.fromEntries(loaded);
}

describe("rutas del panel", () => {
  it("encuentra las rutas del panel y deja fuera las del sitio", () => {
    expect(listPanelFiles()).toEqual(
      expect.arrayContaining([
        PANEL_LAYOUT,
        "routes/panel/home.tsx",
        "routes/panel/sign-out.tsx",
      ]),
    );
    expect(listPanelFiles()).not.toContain("routes/contact.tsx");
  });

  it("incluye una ruta colgada del panel aunque viva en otra carpeta", () => {
    const tree: RouteConfigEntry[] = [
      {
        file: PANEL_LAYOUT,
        children: [
          { file: "modules/faq.tsx", children: [{ file: "modules/x.tsx" }] },
        ],
      },
      { file: "routes/contact.tsx" },
    ];

    expect(listDeclaredPanelFiles(tree)).toEqual([
      PANEL_LAYOUT,
      "modules/faq.tsx",
      "modules/x.tsx",
    ]);
  });

  it.each(["admin/exportar", "en/admin/export"])(
    "incluye una ruta con dirección %s declarada fuera del panel",
    (path) => {
      const tree: RouteConfigEntry[] = [
        { file: "routes/admin-export.ts", path },
        { file: "routes/contact.tsx", path: "administracion" },
      ];

      expect(listDeclaredPanelFiles(tree)).toEqual(["routes/admin-export.ts"]);
    },
  );

  it("arma la dirección de una ruta anidada con la de sus padres", () => {
    const tree: RouteConfigEntry[] = [
      {
        file: "routes/prefix.tsx",
        path: "en",
        children: [{ file: "modules/export.ts", path: "admin/export" }],
      },
    ];

    expect(listDeclaredPanelFiles(tree)).toEqual(["modules/export.ts"]);
  });

  it("toda action del panel usa la pieza de la bitácora", async () => {
    const modules = await loadModules(listPanelFiles());

    expect(findUnauditedActions(modules)).toEqual([]);
  });

  it("nombra el archivo cuya action no usa la pieza", () => {
    const modules = {
      "routes/panel/faq.tsx": { action: async () => null },
      "routes/panel/home.tsx": { loader: () => null },
    };

    expect(findUnauditedActions(modules)).toEqual(["routes/panel/faq.tsx"]);
  });

  it("cerrar sesión está en las excepciones, con su razón escrita", () => {
    expect(ACTIONS_WITHOUT_AUDIT["routes/panel/sign-out.tsx"]).toMatch(
      /Cerrar sesión/,
    );
  });

  it("ninguna excepción sobra: todas exportan una action sin la pieza", async () => {
    const modules = await loadModules(Object.keys(ACTIONS_WITHOUT_AUDIT));

    for (const [file, module] of Object.entries(modules)) {
      expect(module.action, file).toBeTypeOf("function");
      expect(isAdminAction(module.action), file).toBe(false);
    }
  });
});
