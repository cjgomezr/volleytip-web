import { describe, expect, it } from "vitest";

import { getMenuEntries, MENU_ENTRIES } from "./site-menu";
import type { PageDeclaration } from "./i18n/page-path";

const HOME: PageDeclaration = { id: "home", file: "routes/home.tsx", path: "" };
const TIPS: PageDeclaration = {
  id: "tips",
  file: "routes/tips.tsx",
  path: "tips",
};
const SHOP: PageDeclaration = {
  id: "shop",
  file: "routes/shop.tsx",
  path: { es: "tienda", en: "shop" },
};

describe("menú del sitio", () => {
  it("declares the six entries in the order of FR-002", () => {
    expect(MENU_ENTRIES.map(({ id }) => id)).toEqual([
      "tips",
      "camps",
      "vballTour",
      "shop",
      "app",
      "about",
    ]);
  });

  it("returns no entries while none of its pages exists", () => {
    expect(getMenuEntries([HOME], "es")).toEqual([]);
  });

  it("shows an entry once its page is in the page map", () => {
    const entries = getMenuEntries([HOME, TIPS], "es");

    expect(entries).toEqual([
      { id: "tips", labelKey: "header.menu.tips", href: "/tips" },
    ]);
  });

  it("links each entry to its page in the requested language", () => {
    const [entry] = getMenuEntries([SHOP], "en");

    expect(entry?.href).toBe("/en/shop");
  });

  it("keeps the menu order whatever the order of the page map", () => {
    const entries = getMenuEntries([SHOP, TIPS], "es");

    expect(entries.map(({ id }) => id)).toEqual(["tips", "shop"]);
  });
});
