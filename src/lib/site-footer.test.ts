import { describe, expect, it } from "vitest";

import type { PageDeclaration } from "./i18n/page-path";
import { FOOTER_LINKS, getFooterColumns } from "./site-footer";

const page = (
  id: string,
  path: PageDeclaration["path"] = id,
): PageDeclaration => ({ id, file: `routes/${id}.tsx`, path });

describe("pie: enlaces", () => {
  it("declares the links in the order of FR-003", () => {
    expect(FOOTER_LINKS.map(({ id }) => id)).toEqual([
      "tips",
      "camps",
      "vballTour",
      "shop",
      "app",
      "about",
      "contact",
      "faq",
      "myPurchases",
      "terms",
      "privacy",
    ]);
  });

  it("paints no link while its page is not in the page map", () => {
    expect(getFooterColumns([page("home", "")], "es")).toEqual([]);
  });

  it("paints a link in the language of the page once its page exists", () => {
    const shop = page("shop", { es: "tienda", en: "shop" });

    const spanish = getFooterColumns([shop], "es");
    const english = getFooterColumns([shop], "en");

    expect(spanish[0]?.links.map(({ href }) => href)).toEqual(["/tienda"]);
    expect(english[0]?.links.map(({ href }) => href)).toEqual(["/en/shop"]);
  });

  it("keeps the declared order inside a column", () => {
    const columns = getFooterColumns([page("about"), page("tips")], "es");
    const ids = columns.flatMap(({ links }) => links.map(({ id }) => id));

    expect(ids).toEqual(["tips", "about"]);
  });

  it("drops the title of a column left without links", () => {
    const columns = getFooterColumns([page("privacy")], "es");

    expect(columns).toHaveLength(1);
    expect(columns[0]?.links.map(({ id }) => id)).toEqual(["privacy"]);
  });
});
