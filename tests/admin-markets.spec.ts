/**
 * "Idiomas y mercados" (#128): accesibilidad, desborde y zonas de toque con
 * datos y con cada rechazo, en los cuatro anchos y los dos idiomas. No
 * escriben nada: lo que cambia la base vive en admin-markets-writes.spec.ts y
 * las capturas, en ui.spec.ts.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { waitForSettledPage } from "./support/page-ready";
import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const SIDEBAR_FROM_WIDTH = 768;
/** Holgura para lo que todavía crezca después de medir la página. */
const SPARE_HEIGHT = 200;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const STATES = ["datos", "ultimo-mercado", "tasa-invalida"] as const;

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  // Con la ventana tan alta como la página, la barra inferior fija no tapa a
  // medias ningún control: axe lo contaría como una zona de toque pequeña.
  // Se mide con las fuentes ya cargadas y se deja holgura: si la página crece
  // después de medirla, el último botón vuelve a quedar a medias bajo la barra.
  const width = page.viewportSize()?.width ?? 0;
  const height = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.documentElement.scrollHeight;
  });
  await page.setViewportSize({ width, height: height + SPARE_HEIGHT });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

async function expectTouchTargets(page: Page): Promise<void> {
  const controls = page
    .getByRole("main")
    .locator(
      "button, a[href], input[type=text], select, label:has(input[type=checkbox])",
    );
  const boxes = await controls.evaluateAll((elements) =>
    elements.map((element) => ({
      text: element.textContent,
      height: element.getBoundingClientRect().height,
    })),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.height, box.text ?? "").toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
}

for (const viewport of VIEWPORTS) {
  test.describe(`idiomas y mercados @ ${viewport.width}`, () => {
    test.use({ viewport });

    for (const state of STATES) {
      for (const path of ["/dev/mercados", "/en/dev/mercados"]) {
        test(`${path} en estado ${state} es accesible`, async ({ page }) => {
          await page.goto(`${path}?estado=${state}`);

          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectTouchTargets(page);
          await expectAccessibleWithoutOverflow(page);
        });
      }
    }

    test("un admin llega a la pantalla desde el menú", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      const hasSidebar = viewport.width >= SIDEBAR_FROM_WIDTH;
      await page.goto(hasSidebar ? "/admin" : "/admin/mas");
      await waitForSettledPage(page);

      await page
        .getByRole(hasSidebar ? "complementary" : "main")
        .getByRole("link", { name: "Idiomas y mercados" })
        .click();

      await expect(page).toHaveURL("/admin/mercados");
      await expect(
        page.getByRole("heading", { level: 1, name: "Idiomas y mercados" }),
      ).toBeVisible();
      await expectAccessibleWithoutOverflow(page);
    });
  });
}
