/**
 * Términos y Privacidad (#86): accesibilidad, ancho de lectura y `noindex`
 * en las cuatro direcciones y los cuatro anchos. No toma capturas: la línea
 * base de Linux la aprueba una persona con el flujo de visual-baselines.
 */
import { test, expect } from "./support/test";
import AxeBuilder from "@axe-core/playwright";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const PAGES = [
  { path: "/terminos", heading: "Términos y condiciones" },
  { path: "/en/terms", heading: "Terms and conditions" },
  { path: "/privacidad", heading: "Política de privacidad" },
  { path: "/en/privacy", heading: "Privacy policy" },
] as const;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const MAX_COMFORTABLE_LINE_PX = 800;

for (const { path, heading } of PAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${path} @ ${viewport.width}`, () => {
      test.use({ viewport });

      test("se lee sin scroll horizontal y sin violaciones de axe", async ({
        page,
      }) => {
        await page.goto(`${APP_URL}${path}`);
        await expect(
          page.getByRole("heading", { level: 1, name: heading }),
        ).toBeVisible();

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow).toBe(false);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(
          results.violations,
          JSON.stringify(results.violations, null, 2),
        ).toEqual([]);
      });
    });
  }

  test(`${path} avisa que es provisional y pide noindex`, async ({ page }) => {
    await page.goto(`${APP_URL}${path}`);

    await expect(page.getByRole("note")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
  });

  test(`${path} mantiene un ancho de línea cómodo en computador`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${APP_URL}${path}`);

    const width = await page
      .locator("section[data-zone='light'] > div")
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(MAX_COMFORTABLE_LINE_PX);
  });
}
