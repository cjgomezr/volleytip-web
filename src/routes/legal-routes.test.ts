import { describe, expect, it } from "vitest";

import { getPageAtPath, getPagePath } from "~/lib/i18n/pages";
import { getFooterColumns } from "~/lib/site-footer";
import { PAGES } from "~/lib/i18n/pages";

describe("direcciones de los documentos legales", () => {
  it.each([
    ["terms", "es", "/terminos"],
    ["terms", "en", "/en/terms"],
    ["privacy", "es", "/privacidad"],
    ["privacy", "en", "/en/privacy"],
  ] as const)("puts %s in %s at %s", (id, language, expected) => {
    expect(getPagePath(id, language)).toBe(expected);
    expect(getPageAtPath(expected)?.page).toBe(id);
  });

  it("links both from the footer", () => {
    const hrefs = getFooterColumns(PAGES, "es").flatMap((column) =>
      column.links.map(({ href }) => href),
    );

    expect(hrefs).toContain("/terminos");
    expect(hrefs).toContain("/privacidad");
  });
});
