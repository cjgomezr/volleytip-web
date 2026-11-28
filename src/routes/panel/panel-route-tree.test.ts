import type { RouteConfigEntry } from "@react-router/dev/routes";
import { describe, expect, it } from "vitest";

import { PANEL_ADMIN_PAGES, PANEL_MEMBER_PAGES } from "~/lib/i18n/panel-pages";

import routes from "../../routes";

const SHELL = "routes/panel/shell-layout.tsx";
const MEMBER = "routes/panel/member-layout.tsx";
const ADMIN = "routes/panel/admin-layout.tsx";

function findAncestors(
  entries: readonly RouteConfigEntry[],
  file: string,
  above: readonly string[] = [],
): readonly (readonly string[])[] {
  return entries.flatMap((entry) => {
    const found = entry.file === file ? [above] : [];
    const below = findAncestors(entry.children ?? [], file, [
      ...above,
      entry.file,
    ]);
    return [...found, ...below];
  });
}

describe("árbol de rutas del panel", () => {
  it.each(PANEL_ADMIN_PAGES.map(({ file }) => file))(
    "%s falla dentro de la cáscara y detrás de la guardia",
    (file) => {
      const found = findAncestors(routes, file);

      // Una dirección por idioma.
      expect(found).toHaveLength(2);
      for (const ancestors of found) {
        expect(ancestors).toEqual(
          expect.arrayContaining([MEMBER, SHELL, ADMIN]),
        );
      }
    },
  );

  it.each(PANEL_MEMBER_PAGES.map(({ file }) => file))(
    "%s falla dentro de la cáscara",
    (file) => {
      expect(findAncestors(routes, file)[0]).toEqual(
        expect.arrayContaining([MEMBER, SHELL]),
      );
    },
  );
});
