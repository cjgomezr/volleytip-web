import { describe, expect, it } from "vitest";

import { getPageAtPath, getPagePath, PAGES } from "~/lib/i18n/pages";
import { getFooterColumns } from "~/lib/site-footer";
import { getMenuEntries } from "~/lib/site-menu";

describe("app: direcciones y enlaces", () => {
  it.each([
    ["es", "/app"],
    ["en", "/en/app"],
  ] as const)("pone la página de la app en %s en %s", (language, expected) => {
    expect(getPagePath("app", language)).toBe(expected);
    expect(getPageAtPath(expected)?.page).toBe("app");
  });

  it("el menú enlaza a App en los dos idiomas", () => {
    const hrefs = (language: "es" | "en"): string[] =>
      getMenuEntries(PAGES, language).map(({ href }) => href);

    expect(hrefs("es")).toContain("/app");
    expect(hrefs("en")).toContain("/en/app");
  });

  it("el pie enlaza a App", () => {
    const hrefs = getFooterColumns(PAGES, "es").flatMap((column) =>
      column.links.map(({ href }) => href),
    );

    expect(hrefs).toContain("/app");
  });
});
