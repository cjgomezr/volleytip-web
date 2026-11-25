/**
 * Ajustes del panel (#129): accesibilidad, desborde y zonas de toque de cada
 * estado, en los cuatro anchos y los dos idiomas. No escriben nada: lo que
 * cambia ajustes vive en admin-settings-writes.spec.ts y las capturas, en
 * ui.spec.ts.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const SIDEBAR_FROM_WIDTH = 768;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const STATES = [
  "apagado",
  "encendido",
  "invalido",
  "errores",
  "confirmar",
] as const;

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
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
    .locator("button, a[href], input[type=url], label:has(input[type=radio])");
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
  test.describe(`ajustes @ ${viewport.width}`, () => {
    test.use({ viewport });

    for (const state of STATES) {
      for (const path of ["/dev/ajustes", "/en/dev/ajustes"]) {
        test(`${path} en estado ${state} es accesible`, async ({ page }) => {
          await page.goto(`${path}?estado=${state}`);

          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectTouchTargets(page);
          await expectAccessibleWithoutOverflow(page);
        });
      }
    }

    test("un admin llega a Ajustes desde el menú", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      const hasSidebar = viewport.width >= SIDEBAR_FROM_WIDTH;
      await page.goto(hasSidebar ? "/admin" : "/admin/mas");

      await page
        .getByRole(hasSidebar ? "complementary" : "main")
        .getByRole("link", { name: "Ajustes" })
        .click();

      await expect(page).toHaveURL("/admin/ajustes");
      await expect(
        page.getByRole("heading", { level: 1, name: "Ajustes" }),
      ).toBeVisible();
      await expectAccessibleWithoutOverflow(page);
    });
  });
}
