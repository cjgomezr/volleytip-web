import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Los cinco colores de marca del SRD (NFR-007). Si alguien cambia uno en el
// CSS sin pasar por design-system.md, este test lo dice.
const BRAND_COLORS = {
  "--color-brand-red": "#FC0035",
  "--color-brand-indigo": "#221761",
  "--color-brand-night": "#140A35",
  "--color-brand-lime": "#CDF980",
  "--color-brand-mist": "#D9E6E8",
} as const;

const stylesheet = readFileSync(new URL("./app.css", import.meta.url), "utf8");
const designSystem = readFileSync(
  new URL("../design-system.md", import.meta.url),
  "utf8",
);

describe("brand tokens", () => {
  it.each(Object.entries(BRAND_COLORS))(
    "defines %s as %s in the Tailwind theme",
    (token, hex) => {
      expect(stylesheet.toUpperCase()).toContain(
        `${token}: ${hex}`.toUpperCase(),
      );
    },
  );

  it.each(Object.values(BRAND_COLORS))(
    "documents %s in design-system.md",
    (hex) => {
      expect(designSystem).toContain(hex);
    },
  );

  it("uses Anton for display text and Archivo for body text", () => {
    expect(stylesheet).toMatch(/--font-display:\s*"Anton"/);
    expect(stylesheet).toMatch(/--font-sans:\s*"Archivo Variable"/);
  });
});
