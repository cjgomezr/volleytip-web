/**
 * Página de la app (#95): accesibilidad y desborde en cada estado, idioma y
 * ancho, y el envío con teclado. No toma capturas: la línea base de Linux la
 * aprueba una persona con el flujo de visual-baselines. Los estados que
 * dependen del ajuste `app_availability` se ven en `/dev/app`, que no toca la
 * base.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { TURNSTILE_TEST_KEYS } from "../src/lib/forms/turnstile-test-keys";
import { TURNSTILE_FIELD } from "../src/lib/forms/turnstile.server";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
// Pasado este tiempo desde que se pintó el formulario, el servidor ya no lo
// toma por un envío de bot (3 segundos).
const HUMAN_DELAY_MS = 3500;
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/**";
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const STATES = [
  { name: "lista de espera", query: "" },
  { name: "con error", query: "?resultado=invalido" },
  { name: "con confirmación", query: "?resultado=unido" },
  { name: "disponible", query: "?estado=disponible" },
  {
    name: "disponible con una tienda",
    query: "?estado=disponible&tienda=play",
  },
] as const;
const LANGUAGES = [
  { prefix: "", heading: /bolsillo/i, cookie: "ImVzIg%3D%3D" },
  { prefix: "/en", heading: /pocket/i, cookie: "ImVuIg%3D%3D" },
] as const;

// El widget de Cloudflare no se carga: las pruebas no dependen de la red.
async function blockTurnstile(page: Page): Promise<void> {
  await page.route(TURNSTILE_SCRIPT, (route) => route.abort());
}

for (const { prefix, heading, cookie } of LANGUAGES) {
  for (const state of STATES) {
    for (const viewport of VIEWPORTS) {
      test.describe(`${prefix}/dev/app ${state.name} @ ${viewport.width}`, () => {
        test.use({
          viewport,
          storageState: {
            cookies: [
              {
                name: "vt_locale",
                value: cookie,
                domain: new URL(APP_URL).hostname,
                path: "/",
                expires: -1,
                httpOnly: false,
                secure: false,
                sameSite: "Lax",
              },
            ],
            origins: [],
          },
        });

        test("se lee sin scroll horizontal y sin violaciones de axe", async ({
          page,
        }) => {
          await blockTurnstile(page);
          await page.goto(`${APP_URL}${prefix}/dev/app${state.query}`);
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
}

test.describe("/app", () => {
  test("responde 200 en los dos idiomas y marca App como actual en el menú", async ({
    page,
  }) => {
    await blockTurnstile(page);
    for (const path of ["/app", "/en/app"]) {
      const response = await page.goto(`${APP_URL}${path}`);

      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("link", { name: "App", exact: true }).first(),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("las preguntas se abren con teclado", async ({ page }) => {
    await blockTurnstile(page);
    await page.goto(`${APP_URL}/app`);
    const summary = page.getByText("¿Es gratis?");
    await summary.focus();
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Sí, la app es completamente gratis."),
    ).toBeVisible();
  });

  test("un correo inválido, enviado con teclado, muestra el error junto al campo y conserva lo escrito", async ({
    page,
  }) => {
    await blockTurnstile(page);
    await page.goto(`${APP_URL}/app`);
    // Sin el widget de Cloudflare, el token de prueba hace su papel.
    await page.evaluate(
      ({ field, token }) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = field;
        input.value = token;
        document.querySelector("form")?.append(input);
      },
      { field: TURNSTILE_FIELD, token: TURNSTILE_TEST_KEYS.dummyToken },
    );
    await page.waitForTimeout(HUMAN_DELAY_MS);
    const email = page.getByLabel("Avísame cuando salga");
    await email.focus();
    await page.keyboard.type("ana@");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Escribe un correo válido.")).toBeVisible();
    await expect(email).toHaveValue("ana@");
    await expect(email).toHaveAttribute("aria-invalid", "true");
  });
});
