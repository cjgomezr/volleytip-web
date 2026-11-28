/**
 * Página Nosotros (#96): responde en los dos idiomas, sin violaciones de axe
 * ni desborde horizontal en los cuatro anchos, y el menú la marca como
 * actual. Las capturas están en `ui.spec.ts`.
 */
import { waitForSettledPage } from "./support/page-ready";
import { test, expect, waitForImages } from "./support/test";
import AxeBuilder from "@axe-core/playwright";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const LANGUAGES = [
  { path: "/nosotros", heading: /el voley es para/i, menu: "Nosotros" },
  { path: "/en/about", heading: /volleyball is for/i, menu: "About" },
] as const;

for (const { path, heading } of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${path} @ ${viewport.width}`, () => {
      test.use({ viewport });

      test("se lee sin scroll horizontal y sin violaciones de axe", async ({
        page,
      }) => {
        const response = await page.goto(`${APP_URL}${path}`);
        expect(response?.status()).toBe(200);
        await expect(
          page.getByRole("heading", { level: 1, name: heading }),
        ).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await waitForImages(page);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow, `desborde a ${viewport.width}px`).toBe(false);

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
}

test.describe("navegación a Nosotros", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { path, menu } of LANGUAGES) {
    test(`${path}: el menú la marca como actual`, async ({ page }) => {
      await page.goto(`${APP_URL}${path}`);

      await expect(
        page
          .getByRole("navigation")
          .first()
          .getByRole("link", { name: menu, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    });
  }

  test("la home enlaza a Nosotros desde su bloque de equipo", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await waitForSettledPage(page);
    await page.getByRole("link", { name: "Conoce al equipo" }).click();

    await expect(page).toHaveURL(/\/nosotros$/);
  });
});
