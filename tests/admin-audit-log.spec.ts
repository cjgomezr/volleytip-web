/**
 * "Bitácora" (#131). Los estados se prueban en la página de muestra
 * (/dev/panel/bitacora?bitacora=...), que no usa la base; filtrar y abrir una
 * entrada, en el panel real. Las capturas viven en `ui.spec.ts`.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const MAX_TAB_PRESSES = 60;
/** Holgura para lo que todavía crezca después de medir la página. */
const SPARE_HEIGHT = 200;
/** La entrada que deja cambiar de idioma: la que estas pruebas filtran. */
const LOCALE_ACTION = "profile.set_locale";
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const LANGUAGES = [
  {
    code: "es",
    sample: "/dev/panel/bitacora",
    panel: "/admin/bitacora",
    title: "Bitácora",
    person: "Persona",
    action: "Acción",
    from: "Desde",
    to: "Hasta",
    apply: "Filtrar",
    clear: "Quitar filtros",
    empty: "No hay entradas para mostrar.",
    inverted: "La fecha final es anterior a la inicial.",
    entry: "Entrada",
    back: "Volver a la bitácora",
    system: "Sistema",
  },
  {
    code: "en",
    sample: "/en/dev/panel/audit-log",
    panel: "/en/admin/audit-log",
    title: "Audit log",
    person: "Person",
    action: "Action",
    from: "From",
    to: "To",
    apply: "Apply filters",
    clear: "Clear filters",
    empty: "There are no entries to show.",
    inverted: "The end date is before the start date.",
    entry: "Entry",
    back: "Back to the audit log",
    system: "System",
  },
] as const;

// axe mide los controles donde estén: bajo la barra inferior del celular, uno
// a medio tapar cuenta como pequeño. Con la ventana tan alta como la página no
// tapa ninguno.
async function showWholePage(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (size === null) return;
  await page.emulateMedia({ reducedMotion: "reduce" });
  const height = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.documentElement.scrollHeight;
  });
  await page.setViewportSize({
    width: size.width,
    height: height + SPARE_HEIGHT,
  });
}

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  await showWholePage(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

/** Ningún texto de la pantalla se sale de la caja que lo contiene. */
async function expectNoOverflowingText(page: Page): Promise<void> {
  const overflowing = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "main :is(a, button, h1, h2, h3, p, span, label, time, dt, dd)",
      ),
    ]
      .filter(
        (element) =>
          element.checkVisibility() &&
          !element.closest(".sr-only") &&
          element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth + 1,
      )
      .map((element) => element.textContent),
  );
  expect(overflowing).toEqual([]);
}

async function expectTouchTargets(controls: Locator): Promise<void> {
  const all = await controls.all();
  expect(all.length).toBeGreaterThan(0);
  for (const control of all) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
}

async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
    await page.keyboard.press("Tab");
    const isFocused = await target.evaluate(
      (element) => element === document.activeElement,
    );
    if (isFocused) return;
  }
  throw new Error("Con el teclado no se llega al control");
}

for (const language of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`bitácora ${language.code} @ ${viewport.width}`, () => {
      test.use({ viewport });

      for (const state of ["datos", "vacio", "rango", "detalle"]) {
        test(`${state}: axe, sin desborde y controles tocables`, async ({
          page,
        }) => {
          await page.goto(`${language.sample}?bitacora=${state}`);

          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            state === "detalle" ? language.entry : language.title,
          );
          await expect(page.getByRole("main").locator("table")).toHaveCount(0);
          await expectNoOverflowingText(page);
          await expectTouchTargets(
            page.getByRole("main").locator("a, button, select, input"),
          );
          await expectAccessibleWithoutOverflow(page);
        });
      }

      test("vacía y con el rango invertido lo dice y ofrece quitar los filtros", async ({
        page,
      }) => {
        for (const [state, message] of [
          ["vacio", language.empty],
          ["rango", language.inverted],
        ] as const) {
          await page.goto(`${language.sample}?bitacora=${state}`);

          await expect(page.getByText(message)).toBeVisible();
          await expect(
            page.getByRole("link", { name: language.clear }),
          ).toHaveAttribute("href", language.sample);
        }
      });

      test("filtra con el teclado, conserva al recargar y abre una entrada", async ({
        page,
        signInToPanel,
      }) => {
        await signInToPanel({ role: "admin", fullName: "Andrés Gómez" });
        // Cambiar de idioma escribe en la bitácora: deja una entrada propia.
        await page.goto("/admin");
        await page.waitForLoadState("networkidle");
        await page
          .getByRole("button", { name: "English" })
          .filter({ visible: true })
          .click();
        await expect(page).toHaveURL("/en/admin");
        await page.goto(language.panel);
        await page.waitForLoadState("networkidle");
        const action = page.getByLabel(language.action, { exact: true });

        await tabUntilFocused(page, action);
        await page.keyboard.type(LOCALE_ACTION);
        await tabUntilFocused(
          page,
          page.getByRole("button", { name: language.apply }),
        );
        await page.keyboard.press("Enter");

        await expect(page).toHaveURL(
          new RegExp(`accion=${LOCALE_ACTION.replace(".", "\\.")}`),
        );
        await expect(
          page.getByRole("button", { name: language.apply }),
        ).toBeFocused();
        await page.reload();
        await page.waitForLoadState("networkidle");
        await expect(action).toHaveValue(LOCALE_ACTION);
        await expectNoOverflowingText(page);

        const first = page
          .getByRole("main")
          .getByRole("link", { name: new RegExp(LOCALE_ACTION) })
          .first();
        await tabUntilFocused(page, first);
        await page.keyboard.press("Enter");

        await expect(
          page.getByRole("heading", { level: 1, name: language.entry }),
        ).toBeVisible();
        await expect(page.locator('[data-audit-field="locale"]')).toBeVisible();
        await expectAccessibleWithoutOverflow(page);

        await page.getByRole("link", { name: language.back }).click();

        await expect(action).toHaveValue(LOCALE_ACTION);

        await page.getByRole("link", { name: language.clear }).click();

        await expect(page).toHaveURL(language.panel);
        await expect(action).toHaveValue("");
      });
    });
  }
}

test.describe("bitácora: sin JavaScript", () => {
  test("los filtros quedan en la dirección y se combinan", async ({
    browser,
    signInToPanel,
    context,
  }) => {
    await signInToPanel({ role: "admin" });
    const plain = await browser.newContext({
      javaScriptEnabled: false,
      storageState: await context.storageState(),
    });
    const page = await plain.newPage();
    await page.goto("/admin/bitacora");
    await page.getByLabel("Desde").fill("2026-11-24");
    await page.getByLabel("Hasta").fill("2026-11-01");

    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(page).toHaveURL(/desde=2026-11-24&hasta=2026-11-01/);
    await expect(
      page.getByText("La fecha final es anterior a la inicial."),
    ).toBeVisible();
    await expect(page.getByLabel("Desde")).toHaveValue("2026-11-24");
    await plain.close();
  });

  test("una dirección con valores inválidos responde 200", async ({
    page,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });

    const answer = await page.goto(
      "/admin/bitacora?desde=ayer&persona=nadie&pagina=x",
    );

    expect(answer?.status()).toBe(200);
  });
});
