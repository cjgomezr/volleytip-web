/**
 * Preguntas frecuentes (#93): axe y desborde en los cuatro anchos y los dos
 * idiomas, con preguntas (/dev/faq) y vacía, y abrir y cerrar con teclado.
 * Las capturas están en `ui.spec.ts`. La página real lee de la base, que nace
 * sin preguntas: ahí solo se comprueba que responde 200 con su estado vacío.
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
const VARIANTS = [
  {
    name: "es con preguntas",
    path: "/dev/faq",
    heading: /preguntas frecuentes/i,
  },
  {
    name: "es vacía",
    path: "/dev/faq?estado=vacia",
    heading: /preguntas frecuentes/i,
  },
  {
    name: "en con preguntas",
    path: "/en/dev/faq",
    heading: /frequently asked questions/i,
  },
  {
    name: "en vacía",
    path: "/en/dev/faq?estado=vacia",
    heading: /frequently asked questions/i,
  },
] as const;

for (const { name, path, heading } of VARIANTS) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${name} @ ${viewport.width}`, () => {
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

test.describe("teclado", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("una pregunta se abre y se cierra con Enter", async ({ page }) => {
    await page.goto(`${APP_URL}/dev/faq`);
    const first = page.locator("details").first();
    await page.locator("summary").first().focus();

    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("open", "");

    await page.keyboard.press("Enter");
    await expect(first).not.toHaveAttribute("open", "");
  });

  test("la página real responde 200 y dice que no hay preguntas", async ({
    page,
  }) => {
    const response = await page.goto(`${APP_URL}/preguntas-frecuentes`);

    expect(response?.status()).toBe(200);
    await expect(page.getByText(/todavía no hay preguntas/i)).toBeVisible();
  });

  test("/en/faq sale en inglés y el pie la enlaza", async ({ page }) => {
    await page.goto(`${APP_URL}/en/faq`);

    await expect(
      page.getByRole("heading", { level: 1, name: /frequently asked/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("link", { name: /faq|frequently/i }),
    ).toBeVisible();
  });
});
