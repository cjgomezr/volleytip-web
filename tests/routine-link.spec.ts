/**
 * Enlace compartido de una rutina, `/r/<código>` (#97): accesibilidad y
 * desborde en los cuatro anchos y los dos idiomas, y lo que declara el
 * documento. Las capturas están en `ui.spec.ts`.
 */
import { test, expect } from "./support/test";
import AxeBuilder from "@axe-core/playwright";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const LANGUAGES = [
  { prefix: "", heading: /te compartieron una rutina/i },
  { prefix: "/en", heading: /a routine was shared with you/i },
] as const;

for (const { prefix, heading } of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${prefix}/r/abc123 @ ${viewport.width}`, () => {
      test.use({ viewport });

      test("se lee sin scroll horizontal y sin violaciones de axe", async ({
        page,
      }) => {
        await page.goto(`${APP_URL}${prefix}/r/abc123`);
        await expect(
          page.getByRole("heading", { level: 1, name: heading }),
        ).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
        });

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
}

test.describe("/r/", () => {
  test("responde 200, con noindex, canónica sin el código y sin mostrarlo", async ({
    page,
  }) => {
    const response = await page.goto(`${APP_URL}/r/abc123`);

    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).not.toContain("abc123");
    await expect(page.locator("body")).not.toContainText("abc123");
  });

  test("pide el correo de la lista de espera", async ({ page }) => {
    await page.goto(`${APP_URL}/r/abc123`);

    await expect(page.getByLabel("Avísame cuando salga")).toBeVisible();
  });

  test("sin código o con un código inválido responde 404", async ({
    request,
  }) => {
    for (const path of ["/r/", "/r/a.b", `/r/${"a".repeat(65)}`, "/r/a%2Fb"]) {
      const response = await request.get(`${APP_URL}${path}`);

      expect(response.status(), path).toBe(404);
    }
  });

  test("los archivos de .well-known responden JSON sin redirigir", async ({
    request,
  }) => {
    for (const path of [
      "/.well-known/assetlinks.json",
      "/.well-known/apple-app-site-association",
    ]) {
      const response = await request.get(`${APP_URL}${path}`, {
        maxRedirects: 0,
      });

      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/json");
    }
  });
});
