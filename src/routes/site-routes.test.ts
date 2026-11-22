import type { RouteConfigEntry } from "@react-router/dev/routes";
import { describe, expect, it } from "vitest";

import { PAGES } from "~/lib/i18n/pages";

import routes from "../routes";

const LAYOUT_FILE = "routes/site-layout.tsx";

function flatten(entries: readonly RouteConfigEntry[]): RouteConfigEntry[] {
  return entries.flatMap((entry) => [entry, ...flatten(entry.children ?? [])]);
}

const layout = routes.find((entry) => entry.file === LAYOUT_FILE);
const insideShell = flatten(layout?.children ?? []);
const outsideShell = routes.filter((entry) => entry !== layout);

describe("rutas sin cáscara", () => {
  it("has a layout route without a path of its own", () => {
    expect(layout).toBeDefined();
    expect(layout?.path).toBeUndefined();
  });

  it("keeps every page of the page map inside the shell, in every language", () => {
    const pageFiles = insideShell.filter((entry) =>
      PAGES.some((page) => page.file === entry.file),
    );

    expect(pageFiles).toHaveLength(PAGES.length * 2);
  });

  it("puts the 404 inside the shell", () => {
    expect(insideShell.some((entry) => entry.path === "*")).toBe(true);
  });

  it.each(["healthz", "dev/componentes", "dev/cabeceras", "idioma"])(
    "leaves %s outside the shell",
    (path) => {
      expect(outsideShell.some((entry) => entry.path === path)).toBe(true);
      expect(insideShell.some((entry) => entry.path === path)).toBe(false);
    },
  );
});
