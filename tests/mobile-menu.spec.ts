/**
 * Menú de celular (#83): abre a pantalla completa por debajo de 768 px, con
 * foco atrapado, Escape y botón de cerrar que devuelven el foco, y sin el
 * botón desde 768 px. Sin JavaScript el botón es un enlace al pie.
 */
import { waitForSettledPage } from "./support/page-ready";
import { test, expect } from "./support/test";
import AxeBuilder from "@axe-core/playwright";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const PHONE = { width: 360, height: 800 };
const MIN_ENTRY_HEIGHT = 48;
const ENTRY_FONT_SIZE = "30px";

test.use({
  viewport: PHONE,
  storageState: {
    cookies: [
      {
        name: "vt_locale",
        value: "ImVzIg%3D%3D",
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

test.describe("menú de celular a 360 px", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test("el botón tiene nombre y aria-expanded", async ({ page }) => {
    const opener = page.getByRole("button", { name: "Abrir menú" });

    await expect(opener).toHaveAttribute("aria-expanded", "false");
    await opener.click();
    await expect(opener).toHaveAttribute("aria-expanded", "true");
  });

  test("abierto ocupa toda la pantalla y la página de atrás no se desplaza", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const dialog = page.getByRole("dialog", { name: "Menú" });

    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, ...PHONE });
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  });

  test("cada opción mide 48 px o más y su letra es de 30 px", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const entries = page
      .getByRole("dialog", { name: "Menú" })
      .getByRole("navigation", { name: "Menú principal" })
      .getByRole("link");

    expect(await entries.count()).toBeGreaterThan(0);
    for (const entry of await entries.all()) {
      const box = await entry.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_ENTRY_HEIGHT);
      await expect(entry).toHaveCSS("font-size", ENTRY_FONT_SIZE);
    }
  });

  test("Escape cierra y devuelve el foco al botón", async ({ page }) => {
    const opener = page.getByRole("button", { name: "Abrir menú" });
    await opener.click();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("el botón de cerrar cierra y devuelve el foco al botón", async ({
    page,
  }) => {
    const opener = page.getByRole("button", { name: "Abrir menú" });
    await opener.click();

    await page.getByRole("button", { name: "Cerrar menú" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("Tab y Mayús+Tab no sacan el foco del menú", async ({ page }) => {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const dialog = page.getByRole("dialog", { name: "Menú" });
    const isFocusInside = (): Promise<boolean> =>
      dialog.evaluate((element) => element.contains(document.activeElement));

    for (let press = 0; press < 20; press += 1) {
      await page.keyboard.press("Tab");
      expect(await isFocusInside()).toBe(true);
    }
    for (let press = 0; press < 20; press += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await isFocusInside()).toBe(true);
    }
  });

  test("elegir una opción abre esa página y cierra el menú", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Abrir menú" }).click();

    await page
      .getByRole("dialog", { name: "Menú" })
      .getByRole("link", { name: "Nosotros" })
      .click();

    await expect(page).toHaveURL(/\/nosotros$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("marca la página actual y muestra idioma y redes al pie", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/nosotros`);
    await waitForSettledPage(page);
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const dialog = page.getByRole("dialog", { name: "Menú" });

    await expect(
      dialog.getByRole("link", { name: "Nosotros" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      dialog.getByRole("navigation", { name: "Idioma del menú" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("list", { name: "Redes sociales" }).getByRole("link"),
    ).toHaveCount(5);
  });
});

test.describe("menú de celular sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("el botón es un enlace a la navegación del pie", async ({ page }) => {
    await page.goto(APP_URL);

    const link = page.getByRole("link", { name: "Abrir menú" });
    await expect(link).toHaveAttribute("href", "#pie");
    await link.click();
    await expect(page).toHaveURL(/#pie$/);
  });
});

test.describe("menú de celular desde 768 px", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("no hay botón de menú", async ({ page }) => {
    await page.goto(APP_URL);

    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeHidden();
  });
});

const OPEN_MENU_VARIANTS = [
  { width: 360, height: 800, language: "es", path: "/", opener: "Abrir menú" },
  { width: 390, height: 844, language: "es", path: "/", opener: "Abrir menú" },
  {
    width: 360,
    height: 800,
    language: "en",
    path: "/en/",
    opener: "Open menu",
  },
  {
    width: 390,
    height: 844,
    language: "en",
    path: "/en/",
    opener: "Open menu",
  },
] as const;

for (const variant of OPEN_MENU_VARIANTS) {
  test.describe(`menú abierto @ ${variant.width} en ${variant.language}`, () => {
    test.use({ viewport: { width: variant.width, height: variant.height } });

    test("axe no reporta violaciones y no hay captura rota", async ({
      page,
    }, testInfo) => {
      await page.goto(`${APP_URL}${variant.path}`);
      await waitForSettledPage(page);
      await page.getByRole("button", { name: variant.opener }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([]);
      await testInfo.attach("menu-abierto", {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    });
  });
}
