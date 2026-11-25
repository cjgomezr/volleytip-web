/**
 * Entrar al panel con el enlace del correo (#120), contra la base local y su
 * buzón de pruebas. Las capturas de cada estado viven en `ui.spec.ts`.
 */
import AxeBuilder from "@axe-core/playwright";

import { TURNSTILE_TEST_KEYS } from "../src/lib/forms/turnstile-test-keys";
import { TURNSTILE_FIELD } from "../src/lib/forms/turnstile.server";
import { findLink, waitForEmail } from "../src/testing/local-mailbox";
import { expect, test } from "./support/panel-session";
import type { Page } from "./support/test";

// El formulario rechaza lo que llega antes de 3 segundos.
const HUMAN_DELAY_MS = 3500;
const MIN_TOUCH_TARGET = 44;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const SCREENS = [
  {
    path: "/dev/entrar",
    headings: {
      vacio: "Entrar",
      error: "Entrar",
      enviado: "Entrar",
      enlace: "Entrar",
      vencido: "Este enlace ya no sirve",
    },
  },
  {
    path: "/en/dev/entrar",
    headings: {
      vacio: "Sign in",
      error: "Sign in",
      enviado: "Sign in",
      enlace: "Sign in",
      vencido: "This link no longer works",
    },
  },
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

/** El Turnstile de las pruebas no entrega token: el de prueba hace su papel. */
async function passTurnstile(page: Page): Promise<void> {
  await page.evaluate(
    ({ field, token }) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = field;
      input.value = token;
      document.querySelector("main form")?.append(input);
    },
    { field: TURNSTILE_FIELD, token: TURNSTILE_TEST_KEYS.dummyToken },
  );
}

/** Espera a que React haya montado el formulario, que es cuando pide dibujar
 * Turnstile: antes de eso un envío no pasa por el enrutador. */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => "requireTurnstileInteraction" in window);
}

for (const viewport of VIEWPORTS) {
  test.describe(`entrada al panel @ ${viewport.width}`, () => {
    test.use({ viewport });

    for (const { path, headings } of SCREENS) {
      for (const [state, heading] of Object.entries(headings)) {
        test(`${path} en estado ${state}: accesible y sin desborde`, async ({
          page,
        }) => {
          await page.goto(`${path}?estado=${state}`);

          await expect(
            page.getByRole("heading", { level: 1, name: heading }),
          ).toBeVisible();
          const controls = page.locator("main :is(button, a, input:visible)");
          for (const control of await controls.all()) {
            const box = await control.boundingBox();
            // El campo trampa vive fuera de la vista y mide un píxel.
            if (box === null || box.x < 0) continue;
            expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
          }
          await expectAccessibleWithoutOverflow(page);
        });
      }
    }
  });
}

test.describe("entrada al panel con el correo", () => {
  test("el flujo completo con teclado: pedir, abrir el correo y entrar", async ({
    page,
    context,
    signInToPanel,
  }) => {
    const { email } = await signInToPanel({ role: "admin" });
    await context.clearCookies();
    await page.goto("/admin/entrar");
    await waitForHydration(page);
    await passTurnstile(page);
    await page.waitForTimeout(HUMAN_DELAY_MS);

    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/^Correo/)).toBeFocused();
    await page.keyboard.type(`  ${email.toUpperCase()} `);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Enviarme el enlace" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("status").filter({ hasText: "Revisa tu correo" }),
    ).toBeVisible();
    const link = findLink(await waitForEmail(email), "/admin/entrar/enlace");
    // Otro navegador: sin ninguna cookie del que pidió el enlace.
    await context.clearCookies();
    await page.goto(`${link.pathname}${link.search}`);

    // Cargar la página no deja a nadie adentro.
    expect((await context.cookies()).map(({ name }) => name)).toEqual([]);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Resumen" }),
    ).toBeVisible();

    // El mismo enlace, otra vez: ya se usó.
    await context.clearCookies();
    await page.goto(`${link.pathname}${link.search}`);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(
      page.getByRole("heading", { name: "Este enlace ya no sirve" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Pedir otro enlace" }),
    ).toHaveAttribute("href", "/admin/entrar");
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin/entrar?next=%2Fadmin");
  });

  test("un correo inválido marca el campo y conserva lo escrito", async ({
    page,
  }) => {
    await page.goto("/en/admin/sign-in");
    await waitForHydration(page);
    await passTurnstile(page);
    await page.waitForTimeout(HUMAN_DELAY_MS);

    await page.getByLabel(/^Email/).fill("ana@");
    const answer = page.waitForResponse(
      (response) => response.request().method() === "POST",
    );
    await page.getByLabel(/^Email/).press("Enter");

    expect((await answer).status()).toBe(400);
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toHaveValue("ana@");
    await expectAccessibleWithoutOverflow(page);
  });

  test("un correo ajeno recibe la misma confirmación", async ({ page }) => {
    await page.goto("/admin/entrar");
    await waitForHydration(page);
    await passTurnstile(page);
    await page.waitForTimeout(HUMAN_DELAY_MS);

    await page.getByLabel(/^Correo/).fill("nadie@ejemplo.co");
    await page.getByLabel(/^Correo/).press("Enter");

    await expect(
      page.getByRole("status").filter({ hasText: "Revisa tu correo" }),
    ).toBeVisible();
  });
});
