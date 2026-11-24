/**
 * Página de contacto (#94): axe y desborde en cada motivo, estado, idioma y
 * ancho; cambiar de motivo y enviar con teclado; cambiar de motivo sin
 * JavaScript. Las capturas están en `ui.spec.ts`. Los estados con error y con
 * confirmación se ven en `/dev/contact`, que no toca la base.
 */
import { test, expect } from "./support/test";
import AxeBuilder from "@axe-core/playwright";

import { TURNSTILE_TEST_KEYS } from "../src/lib/forms/turnstile-test-keys";
import { TURNSTILE_FIELD } from "../src/lib/forms/turnstile.server";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
// Pasado este tiempo desde que se pintó el formulario, el servidor ya no lo
// toma por un envío de bot (3 segundos).
const HUMAN_DELAY_MS = 3500;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const STATES = [
  { name: "pedido", query: "?motivo=pedido" },
  { name: "marcas", query: "?motivo=marcas" },
  { name: "otro", query: "?motivo=otro" },
  { name: "con errores", query: "?motivo=pedido&resultado=invalido" },
  { name: "con confirmación", query: "?resultado=enviado" },
  { name: "rechazado", query: "?resultado=rechazado" },
] as const;
const LANGUAGES = [
  { prefix: "", heading: /hablemos/i },
  { prefix: "/en", heading: /let's talk/i },
] as const;

for (const { prefix, heading } of LANGUAGES) {
  for (const state of STATES) {
    for (const viewport of VIEWPORTS) {
      test.describe(`${prefix}/dev/contact ${state.name} @ ${viewport.width}`, () => {
        test.use({ viewport });

        test("se lee sin scroll horizontal y sin violaciones de axe", async ({
          page,
        }) => {
          const response = await page.goto(
            `${APP_URL}${prefix}/dev/contact${state.query}`,
          );
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
}

test.describe("la página real", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("/contacto y /en/contact responden 200 con su título", async ({
    page,
  }) => {
    const spanish = await page.goto(`${APP_URL}/contacto`);
    expect(spanish?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Hablemos" }),
    ).toBeVisible();

    const english = await page.goto(`${APP_URL}/en/contact`);
    expect(english?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Let's talk" }),
    ).toBeVisible();
  });

  test("un motivo desconocido responde 200 y usa 'Otro'", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/contacto?motivo=pizza`);

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("link", { name: "Otro", exact: true }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("el pie enlaza a Contacto", async ({ page }) => {
    await page.goto(`${APP_URL}/`);

    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Contacto" }),
    ).toHaveAttribute("href", "/contacto");
  });

  test("cambiar de motivo con teclado agrega y quita el campo propio", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/contacto`);
    await expect(page.getByLabel(/número de pedido/i)).toHaveCount(0);

    await page.getByRole("link", { name: "Un pedido" }).focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/motivo=pedido/);
    await expect(page.getByLabel(/número de pedido/i)).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(/número de pedido/i)).toBeVisible();
  });

  test("un envío vacío, hecho con teclado, marca los errores junto a sus campos", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/contacto?motivo=pedido`);
    // El Turnstile de las pruebas (tests/support/test.ts) no entrega token:
    // el de prueba hace su papel.
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
    await page.waitForTimeout(HUMAN_DELAY_MS);
    await page.getByLabel(/^Correo/).fill("ana@");
    await page.getByLabel(/^Correo/).press("Enter");

    await expect(page.getByText("Escribe un correo válido.")).toBeVisible();
    await expect(page.getByText("Escribe tu nombre.")).toBeVisible();
    await expect(
      page.getByText("Escribe el número de tu pedido."),
    ).toBeVisible();
    await expect(page.getByLabel(/^Correo/)).toHaveValue("ana@");
    await expect(page.getByLabel(/^Correo/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("un envío válido muestra la confirmación en el lugar del formulario", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/contacto?motivo=marcas`);
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
    await page.waitForTimeout(HUMAN_DELAY_MS);
    await page.getByLabel(/^Nombre/).fill("Ana Pérez");
    await page.getByLabel(/^Correo/).fill("ana@ejemplo.co");
    await page.getByLabel(/marca o club/i).fill("Club Cali");
    await page.getByLabel(/^Mensaje/).fill("Quiero patrocinar un torneo.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    const status = page.getByRole("status");
    await expect(status).toContainText("Mensaje enviado");
    await expect(
      page.getByRole("button", { name: "Enviar mensaje" }),
    ).toHaveCount(0);
  });
});

test.describe("sin JavaScript", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });

  test("el motivo se cambia con el enlace y el campo propio aparece", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/contacto`);
    await page.getByRole("link", { name: "Marcas y colaboraciones" }).click();

    await expect(page).toHaveURL(/motivo=marcas/);
    await expect(page.getByLabel(/marca o club/i)).toBeVisible();
  });
});
