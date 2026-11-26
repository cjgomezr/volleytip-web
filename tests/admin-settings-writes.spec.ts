/**
 * Ajustes del panel (#129) contra la base local, de punta a punta.
 *
 * Estas pruebas ESCRIBEN ajustes que cambian el sitio entero (con el
 * mantenimiento encendido todo responde 503). Por eso tienen su propio
 * proyecto en playwright.config.ts, que corre solo y después de todas las
 * demás. Cada prueba deja los ajustes como estaban, también si falla.
 */
import type { Locator, Page } from "@playwright/test";

import { readLocalSupabaseStatusOnce } from "./support/local-supabase-status-once";
import { expect, test as panelTest } from "./support/panel-session";
import {
  readSettingRows,
  removeSettingRows,
  restoreSettingRows,
} from "./support/settings-rows";

const KEYS = ["maintenance_mode", "app_availability"];
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const MAINTENANCE_STATUS = 503;
const APP_STORE = "https://apps.apple.com/co/app/volleytip/id1234567890";
const STRIPE = '[data-panel-region="maintenance"]';

const test = panelTest.extend<{ cleanSettings: undefined }>({
  cleanSettings: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const status = readLocalSupabaseStatusOnce();
      const original = await readSettingRows(status, KEYS);
      await removeSettingRows(status, KEYS);
      try {
        await use(undefined);
      } finally {
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

for (const javaScriptEnabled of [true, false]) {
  test.describe(`ajustes ${javaScriptEnabled ? "con" : "sin"} JavaScript`, () => {
    test.use({ javaScriptEnabled });

    test("enciende el mantenimiento con confirmación y lo apaga", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await page.goto("/admin/ajustes");

      await pressOn(page.getByRole("link", { name: "Encender mantenimiento" }));

      await expect(page).toHaveURL("/admin/ajustes/mantenimiento");
      await expect(
        page.getByText("El sitio público dejará de verse."),
      ).toBeVisible();
      expect(await readStatus(page, "/")).toBe(OK_STATUS);

      await pressOn(page.getByRole("button", { name: "Sí, encender" }));

      await expect(page).toHaveURL("/admin/ajustes?saved=maintenance");
      await expect(page.locator(STRIPE)).toBeVisible();
      for (const path of ["/", "/app", "/en/app"]) {
        expect(await readStatus(page, path), path).toBe(MAINTENANCE_STATUS);
      }
      for (const path of ["/admin", "/en/admin", "/admin/entrar"]) {
        expect(await readStatus(page, path), path).toBe(OK_STATUS);
      }
      const site = await page.goto("/");
      expect(site?.status()).toBe(MAINTENANCE_STATUS);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      await page.goto("/admin/ajustes");
      await pressOn(page.getByRole("button", { name: "Apagar mantenimiento" }));

      await expect(page).toHaveURL("/admin/ajustes?saved=maintenance");
      await expect(page.locator(STRIPE)).toHaveCount(0);
      expect(await readStatus(page, "/")).toBe(OK_STATUS);
    });

    test("rechaza disponible sin direcciones y publica la que sí sirve", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await page.goto("/admin/ajustes");
      const available = page.getByRole("radio", { name: "Disponible" });
      const save = page.getByRole("button", {
        name: "Guardar estado de la app",
      });

      await pressOn(available, "Space");
      const rejection = page.waitForResponse(
        (response) => response.request().method() === "POST",
      );
      await pressOn(save);

      expect((await rejection).status()).toBe(BAD_REQUEST_STATUS);
      const appStore = page.getByLabel("Dirección en App Store");
      await expect(appStore).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText(/al menos una dirección/)).toBeVisible();
      await expect(available).toBeChecked();

      await appStore.fill(APP_STORE);
      await pressOn(save);

      await expect(page).toHaveURL("/admin/ajustes?saved=app");
      await expect(
        page.getByText("El estado de la app quedó guardado."),
      ).toBeVisible();
      await page.goto("/app");
      await expect(page.locator(`main a[href="${APP_STORE}"]`)).toBeVisible();
    });
  });
}
