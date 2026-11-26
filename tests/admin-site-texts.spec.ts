/**
 * "Textos del sitio" (#126). Los estados se prueban en la página de muestra
 * (/dev/panel/textos?textos=...), que no usa la base. En el panel real solo se
 * hace lo que no escribe en ella: lo que sí escribe vive en
 * `admin-site-texts.writes.spec.ts`. Las capturas viven en `ui.spec.ts`.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const MAX_TAB_PRESSES = 60;
/** Holgura para lo que todavía crezca después de medir la página. */
const SPARE_HEIGHT = 200;
const SAMPLE_MESSAGES = [
  "En vivo: nuevo tip cada semana",
  "Volleyball Camp · próximamente",
  "Envío gratis en Colombia desde $200.000",
] as const;
const [FIRST, SECOND, THIRD] = SAMPLE_MESSAGES;
const STATES = ["datos", "errores", "confirmacion", "invalido"] as const;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const LANGUAGES = [
  {
    code: "es",
    sample: "/dev/panel/textos",
    panel: "/admin/textos",
    more: "/admin/mas",
    title: "Textos del sitio",
    sections: "Secciones",
    saveBar: "Guardar barra",
    saved: "Cambios guardados.",
    unchanged: "No había cambios que guardar.",
    rejected: "No se guardó. Revisa lo marcado.",
    warning: "Sin texto en inglés: en /en/ saldrá en español.",
  },
  {
    code: "en",
    sample: "/en/dev/panel/site-texts",
    panel: "/en/admin/site-texts",
    more: "/en/admin/more",
    title: "Site texts",
    sections: "Sections",
    saveBar: "Save bar",
    saved: "Changes saved.",
    unchanged: "There was nothing to save.",
    rejected: "Not saved. Check what is marked.",
    warning: "No English text: /en/ will show it in Spanish.",
  },
] as const;

// axe mide los controles donde estén: bajo la barra inferior del celular, que
// queda pegada a la pantalla, uno a medio tapar cuenta como pequeño. Con la
// ventana tan alta como la página no tapa ninguno. Que no tape al que tiene el
// foco se prueba aparte, con la ventana de siempre.
async function showWholePage(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (size === null) return;
  // Al crecer la ventana el puntero queda sobre otra cosa: sin transiciones,
  // axe no mide un color a medio cambiar.
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
        "main :is(a, button, h1, h2, p, span, label, legend, pre, fieldset)",
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

/** El control se ve entero: dentro de la ventana y sin la barra encima. */
async function expectFullyVisible(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeInViewport({ ratio: 1 });
  const bar = page.locator('[data-panel-region="bottom-bar"]');
  if (!(await bar.isVisible())) return;
  const control = await target.boundingBox();
  const barBox = await bar.boundingBox();
  expect((control?.y ?? 0) + (control?.height ?? 0)).toBeLessThanOrEqual(
    barBox?.y ?? 0,
  );
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

/** Los textos en español de la barra, en el orden de la pantalla. */
function spanishFields(page: Page): Locator {
  return page.locator('input[name="es"]');
}

async function expectMessages(
  page: Page,
  messages: readonly string[],
): Promise<void> {
  await expect(spanishFields(page)).toHaveCount(messages.length);
  for (const [position, message] of messages.entries()) {
    await expect(spanishFields(page).nth(position)).toHaveValue(message);
  }
}

// Sin hidratar, los botones de la lista no hacen nada.
async function openSample(page: Page, path: string): Promise<void> {
  await page.goto(`${path}?textos=datos`);
  await page.waitForLoadState("networkidle");
}

for (const language of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`textos ${language.code} @ ${viewport.width}`, () => {
      test.use({ viewport });

      for (const state of STATES) {
        test(`${state}: axe, sin desborde y botones tocables`, async ({
          page,
        }) => {
          await page.goto(`${language.sample}?textos=${state}`);

          await expect(
            page.getByRole("heading", { level: 1, name: language.title }),
          ).toBeVisible();
          await expectNoOverflowingText(page);
          await expectTouchTargets(page.getByRole("main").getByRole("button"));
          await expectAccessibleWithoutOverflow(page);
        });
      }

      test("con datos avisa el mensaje sin inglés", async ({ page }) => {
        await page.goto(`${language.sample}?textos=datos`);

        await expect(page.getByText(language.warning)).toHaveCount(1);
      });

      test("con errores marca los campos y conserva lo escrito", async ({
        page,
      }) => {
        await page.goto(`${language.sample}?textos=errores`);

        await expect(
          page.getByRole("alert").filter({ hasText: language.rejected }),
        ).toHaveCount(2);
        await expect(page.locator('input[aria-invalid="true"]')).toHaveCount(3);
        await expect(page.locator('input[name="en"]').first()).toHaveValue(
          "Live: a new tip every week",
        );
      });

      test("la confirmación vive en una región de estado", async ({ page }) => {
        await page.goto(`${language.sample}?textos=confirmacion`);

        for (const text of [language.saved, language.unchanged]) {
          await expect(
            page.getByRole("status").filter({ hasText: text }),
          ).toBeVisible();
        }
      });

      test("el panel real abre, guarda sin cambios y lo confirma", async ({
        page,
        signInToPanel,
      }) => {
        await signInToPanel({ role: "admin" });
        await page.goto(language.panel);
        await page.waitForLoadState("networkidle");

        await page.getByRole("button", { name: language.saveBar }).click();

        await expect(
          page.getByRole("status").filter({ hasText: language.unchanged }),
        ).toBeVisible();
        await expect(page).toHaveURL(language.panel);
        await expectNoOverflowingText(page);
        await expectAccessibleWithoutOverflow(page);
      });

      test("el módulo sale en el menú que corresponde al ancho", async ({
        page,
        signInToPanel,
      }) => {
        await signInToPanel({ role: "admin" });
        const hasSidebar = viewport.width >= 768;

        await page.goto(hasSidebar ? language.panel : language.more);

        const menu = hasSidebar
          ? page.getByRole("navigation", {
              name: language.sections,
              exact: true,
            })
          : page.getByRole("main");
        await expect(
          menu.getByRole("link", { name: language.title }),
        ).toBeVisible();
      });
    });
  }
}

for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
  test.describe(`textos: editar la barra @ ${viewport.width}`, () => {
    test.use({ viewport });

    test("reordena con el teclado sin perder el foco", async ({ page }) => {
      await openSample(page, "/dev/panel/textos");
      const down = page.getByRole("button", { name: "Bajar el mensaje 1" });

      await tabUntilFocused(page, down);
      await page.keyboard.press("Enter");

      await expectMessages(page, [SECOND, FIRST, THIRD]);
      const next = page.getByRole("button", { name: "Bajar el mensaje 2" });
      await expect(next).toBeFocused();
      await expectFullyVisible(page, next);
      await expect(
        page.getByRole("status").filter({ hasText: "posición 2" }),
      ).toHaveCount(1);

      // En el último lugar "Bajar" se apaga: el foco pasa a "Subir".
      await page.keyboard.press("Enter");
      await expectMessages(page, [SECOND, THIRD, FIRST]);
      const up = page.getByRole("button", { name: "Subir el mensaje 3" });
      await expect(up).toBeFocused();
      await expectFullyVisible(page, up);
    });

    test("conserva lo escrito al mover un mensaje", async ({ page }) => {
      await openSample(page, "/dev/panel/textos");
      await spanishFields(page).first().fill("Recién escrito");

      await page.getByRole("button", { name: "Bajar el mensaje 1" }).click();

      await expectMessages(page, [SECOND, "Recién escrito", THIRD]);
    });

    test("quita y agrega mensajes, hasta tres", async ({ page }) => {
      await openSample(page, "/dev/panel/textos");
      const add = page.getByRole("button", { name: "Agregar mensaje" });
      await expect(add).toBeDisabled();

      await page.getByRole("button", { name: "Quitar el mensaje 2" }).click();

      await expectMessages(page, [FIRST, THIRD]);
      // Al grupo y no a un campo: en un celular se abriría el teclado.
      await expect(
        page.getByRole("group", { name: "Mensaje 2" }),
      ).toBeFocused();

      await add.click();

      await expectMessages(page, [FIRST, THIRD, ""]);
      await expect(spanishFields(page).nth(2)).toBeFocused();
      await expect(add).toBeDisabled();
    });

    test("sin mensajes lo explica y el foco queda en 'Agregar'", async ({
      page,
    }) => {
      await openSample(page, "/dev/panel/textos");

      for (let left = SAMPLE_MESSAGES.length; left > 0; left -= 1) {
        await page.getByRole("button", { name: "Quitar el mensaje 1" }).click();
      }

      await expectMessages(page, []);
      await expect(page.getByText("la barra no se muestra")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Agregar mensaje" }),
      ).toBeFocused();
      await expectAccessibleWithoutOverflow(page);
    });

    test("la confirmación se va al seguir editando", async ({ page }) => {
      await page.goto("/dev/panel/textos?textos=confirmacion");
      await page.waitForLoadState("networkidle");
      const saved = page.getByText(LANGUAGES[0].saved);
      const unchanged = page.getByText(LANGUAGES[0].unchanged);
      await expect(saved).toBeVisible();

      await page.getByRole("button", { name: "Bajar el mensaje 1" }).click();

      await expect(saved).toHaveCount(0);
      await expect(unchanged).toBeVisible();

      await page.locator('input[name="stats.tiktok.value:es"]').fill("1");

      await expect(unchanged).toHaveCount(0);
    });

    test("el aviso de inglés aparece al borrar el texto", async ({ page }) => {
      await openSample(page, "/dev/panel/textos");
      const warning = page.getByText(LANGUAGES[0].warning);

      await page.locator('input[name="en"]').first().fill("");

      await expect(warning).toHaveCount(2);
    });
  });
}

test.describe("textos: foco en celular", () => {
  test.use({ viewport: VIEWPORTS[0] });

  test("la barra inferior no tapa el control con el foco", async ({ page }) => {
    await openSample(page, "/dev/panel/textos");
    const save = page.getByRole("button", { name: "Guardar barra" });

    await tabUntilFocused(page, save);

    const control = await save.boundingBox();
    const bar = await page
      .getByRole("navigation", { name: "Secciones principales" })
      .boundingBox();
    expect(control).not.toBeNull();
    expect(bar).not.toBeNull();
    expect((control?.y ?? 0) + (control?.height ?? 0)).toBeLessThanOrEqual(
      bar?.y ?? 0,
    );
  });
});

test.describe("textos: el servidor rechaza", () => {
  test("un texto largo responde 400, lo marca y lo conserva", async ({
    page,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });
    await page.goto("/admin/textos");
    await page.waitForLoadState("networkidle");
    const long = "x".repeat(200);
    const field = page
      .getByRole("group", { name: "Instagram" })
      .getByLabel("Valor en español");
    await field.fill(long);
    const answer = page.waitForResponse((response) =>
      response.url().includes("/admin/textos/cifras"),
    );

    await page.getByRole("button", { name: "Guardar cifras" }).click();

    expect((await answer).status()).toBe(400);
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveValue(long);
    await expect(
      page.getByRole("alert").filter({ hasText: LANGUAGES[0].rejected }),
    ).toBeVisible();
    await expectAccessibleWithoutOverflow(page);
  });

  test("en la barra, el error sigue a su mensaje aunque se reordene", async ({
    page,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });
    await page.goto("/admin/textos");
    await page.waitForLoadState("networkidle");
    const long = "x".repeat(200);
    const invalid = page.locator('input[aria-invalid="true"]');
    await spanishFields(page).first().fill(long);
    await page.getByRole("button", { name: "Bajar el mensaje 1" }).click();
    const answer = page.waitForResponse((response) =>
      response.url().includes("/admin/textos/barra"),
    );

    await page.getByRole("button", { name: "Guardar barra" }).click();

    expect((await answer).status()).toBe(400);
    await expect(invalid).toHaveCount(1);
    await expect(spanishFields(page).nth(1)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(spanishFields(page).nth(1)).toHaveValue(long);

    await page.getByRole("button", { name: "Subir el mensaje 2" }).click();

    await expect(invalid).toHaveCount(1);
    await expect(spanishFields(page).first()).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(spanishFields(page).first()).toHaveValue(long);
  });

  test("sin JavaScript, el envío rechazado vuelve a pintar la pantalla", async ({
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
    await page.goto("/admin/textos");
    await page
      .getByRole("group", { name: "TikTok" })
      .getByLabel("Valor en español")
      .fill("x".repeat(200));

    await page.getByRole("button", { name: "Guardar cifras" }).click();

    await expect(page).toHaveURL("/admin/textos/cifras");
    await expect(page.locator('input[aria-invalid="true"]')).toHaveCount(1);
    await plain.close();
  });
});
