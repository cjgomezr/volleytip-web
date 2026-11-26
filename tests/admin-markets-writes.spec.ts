/**
 * "Idiomas y mercados" (#128) contra la base local, de punta a punta.
 *
 * Estas pruebas ESCRIBEN datos que cambian el sitio entero (apagan el inglés).
 * Por eso tienen su propio proyecto en playwright.config.ts, que corre solo y
 * después de todas las demás. Cada prueba deja la base como estaba, también
 * si falla.
 */
import type { Locator, Page } from "@playwright/test";

import { readLocalSupabaseStatusOnce } from "./support/local-supabase-status-once";
import { restoreSeededMarkets } from "./support/markets-rows";
import { expect, test as panelTest } from "./support/panel-session";
import {
  readSettingRows,
  removeSettingRows,
  restoreSettingRows,
} from "./support/settings-rows";

const KEYS = ["usd_reference_rate"];
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

const test = panelTest.extend<{ cleanMarkets: undefined }>({
  cleanMarkets: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const status = readLocalSupabaseStatusOnce();
      const original = await readSettingRows(status, KEYS);
      await removeSettingRows(status, KEYS);
      await restoreSeededMarkets(status);
      try {
        await use(undefined);
      } finally {
        await restoreSeededMarkets(status);
        await restoreSettingRows(status, KEYS, original);
      }
    },
    { auto: true },
  ],
});

/** Activa un control solo con el teclado. */
async function pressOn(control: Locator, key = "Enter"): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press(key);
}

async function readStatus(page: Page, path: string): Promise<number> {
  const response = await page.request.get(path);
  return response.status();
}

async function submitAndReadStatus(
  page: Page,
  button: Locator,
): Promise<number> {
  const answer = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await pressOn(button);
  return (await answer).status();
}

for (const javaScriptEnabled of [true, false]) {
  test.describe(`idiomas y mercados ${javaScriptEnabled ? "con" : "sin"} JavaScript`, () => {
    test.use({ javaScriptEnabled });

    // Sin hidratar, un envío saldría como el del navegador sin JavaScript.
    async function openScreen(page: Page): Promise<void> {
      await page.goto("/admin/mercados");
      if (javaScriptEnabled) await page.waitForLoadState("networkidle");
    }

    test.beforeEach(async ({ page, signInToPanel }) => {
      await signInToPanel({ role: "admin" });
      await openScreen(page);
    });

    test("apaga el inglés, el sitio deja de ofrecerlo y lo vuelve a encender", async ({
      page,
    }) => {
      await pressOn(page.getByRole("button", { name: "Desactivar English" }));

      await expect(
        page.getByRole("button", { name: "Activar English", exact: true }),
      ).toBeVisible();
      expect(await readStatus(page, "/en/contact")).toBe(NOT_FOUND_STATUS);
      expect(await readStatus(page, "/contacto")).toBe(OK_STATUS);
      expect(await readStatus(page, "/en/admin/sign-in")).toBe(OK_STATUS);
      await page.goto("/en/contact");
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('a[hreflang="en"]')).toHaveCount(0);
      await page.goto("/contacto");
      await expect(page.locator('a[hreflang="en"]')).toHaveCount(0);

      await openScreen(page);
      await pressOn(
        page.getByRole("button", { name: "Activar English", exact: true }),
      );

      await expect(
        page.getByRole("button", { name: "Desactivar English" }),
      ).toBeVisible();
      expect(await readStatus(page, "/en/contact")).toBe(OK_STATUS);
    });

    test("explica por qué no se apaga el único mercado activo", async ({
      page,
    }) => {
      await pressOn(
        page.getByRole("checkbox", { name: "Mercado activo" }),
        "Space",
      );

      const status = await submitAndReadStatus(
        page,
        page.getByRole("button", { name: "Guardar mercado CO" }),
      );

      expect(status).toBe(BAD_REQUEST_STATUS);
      await expect(page.getByText(/Es el único mercado activo/)).toBeVisible();
    });

    test("guarda un mercado y la tasa, y rechaza una tasa con puntos", async ({
      page,
    }) => {
      await pressOn(page.getByRole("checkbox", { name: "Nequi" }), "Space");
      await submitAndReadStatus(
        page,
        page.getByRole("button", { name: "Guardar mercado CO" }),
      );
      await expect(page.getByText("Cambios guardados.")).toBeVisible();
      await openScreen(page);
      await expect(page.getByRole("checkbox", { name: "Nequi" })).toBeChecked();

      const rate = page.getByLabel("Pesos por un dólar");
      const save = page.getByRole("button", { name: "Guardar tasa" });
      await rate.fill("4.150");

      expect(await submitAndReadStatus(page, save)).toBe(BAD_REQUEST_STATUS);
      await expect(rate).toHaveAttribute("aria-invalid", "true");

      await rate.fill("4150");
      await submitAndReadStatus(page, save);

      await expect(
        page.getByText("Tasa actual: 4150 pesos por dólar."),
      ).toBeVisible();
    });
  });
}
