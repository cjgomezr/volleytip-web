/**
 * "Preguntas frecuentes" del panel (#127): accesibilidad, desborde y zonas de
 * toque de la lista, la lista vacía y el editor, en los cuatro anchos y los
 * dos idiomas, y las pestañas con teclado. No escriben nada: lo que cambia la
 * base vive en admin-faqs-writes.spec.ts y las capturas, en ui.spec.ts.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { waitForSettledPage } from "./support/page-ready";
import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const SIDEBAR_FROM_WIDTH = 768;
/** Holgura para lo que todavía crezca después de medir la página. */
const SPARE_HEIGHT = 200;
const MISSING_ID = "99999999-9999-4999-8999-999999999999";
const NOT_FOUND_STATUS = 404;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const STATES = ["lista", "vacia", "editor", "errores"] as const;

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  // Con la ventana tan alta como la página, la barra inferior fija no tapa a
  // medias ningún control: axe lo contaría como una zona de toque pequeña.
  const width = page.viewportSize()?.width ?? 0;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await waitForSettledPage(page);
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
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
  const boxes = await page
    .getByRole("main")
    .locator("button, a[href], input:not([type=hidden]), textarea")
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.checkVisibility())
        .map((element) => ({
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
  test.describe(`preguntas del panel @ ${viewport.width}`, () => {
    test.use({ viewport });

    for (const state of STATES) {
      for (const path of ["/dev/preguntas", "/en/dev/preguntas"]) {
        test(`${path} en estado ${state} es accesible`, async ({ page }) => {
          await page.goto(`${path}?estado=${state}`);
          await page.waitForLoadState("networkidle");

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
        .getByRole("link", { name: "Preguntas frecuentes" })
        .click();

      await expect(page).toHaveURL("/admin/preguntas");
      await expect(
        page.getByRole("heading", { level: 1, name: "Preguntas frecuentes" }),
      ).toBeVisible();
    });

    test("un id que no existe responde 404 dentro de la cáscara", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });

      const response = await page.goto(`/admin/preguntas/${MISSING_ID}`);

      expect(response?.status()).toBe(NOT_FOUND_STATUS);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Esa pregunta no existe",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("main").getByRole("link", {
          name: "Volver a las preguntas",
        }),
      ).toBeVisible();
      await expectAccessibleWithoutOverflow(page);
    });
  });
}

test.describe("preguntas: pestañas del editor", () => {
  test("cambian con las flechas y conservan lo escrito", async ({ page }) => {
    await page.goto("/dev/preguntas?estado=editor");
    await page.waitForLoadState("networkidle");
    const spanish = page.getByRole("tab", { name: /Español/ });
    const english = page.getByRole("tab", { name: /English/ });
    await page.getByLabel("Pregunta (Español)").fill("Recién escrita");

    await spanish.focus();
    await page.keyboard.press("ArrowRight");

    await expect(english).toBeFocused();
    await expect(english).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Pregunta (English)")).toBeVisible();
    await expect(page.getByLabel("Pregunta (Español)")).toBeHidden();

    await page.keyboard.press("Home");

    await expect(spanish).toBeFocused();
    await expect(page.getByLabel("Pregunta (Español)")).toHaveValue(
      "Recién escrita",
    );
  });

  test("con errores abre la primera pestaña marcada", async ({ page }) => {
    await page.goto("/en/dev/preguntas?estado=errores");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("tab", { name: /Español/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: /has errors/ })).toHaveCount(2);
    await expect(page.getByLabel("Question (Español)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("se ven los campos de todos los idiomas", async ({ page }) => {
      await page.goto("/dev/preguntas?estado=editor");

      await expect(page.getByLabel("Pregunta (Español)")).toBeVisible();
      await expect(page.getByLabel("Pregunta (English)")).toBeVisible();
      await expect(page.getByRole("tab")).toHaveCount(0);
    });
  });
});
