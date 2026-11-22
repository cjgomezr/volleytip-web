/**
 * Aviso de idioma (FR-005, AC-001): con el navegador en inglés aparece, se
 * acepta o se rechaza, y la elección se recuerda. Las capturas del
 * aviso viven en `ui.spec.ts`, junto a las demás.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const ENGLISH_HOME_URL = `${APP_URL}/en/`;
const COMPONENTS_URL = `${APP_URL}/dev/componentes`;
const LANGUAGE_COOKIE = "vt_locale";
// Playwright anuncia "HeadlessChrome", que isbot reconoce como robot: sin un
// agente de navegador normal el aviso nunca saldría.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

async function readLanguageCookie(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies(APP_URL);
  return cookies.find((cookie) => cookie.name === LANGUAGE_COOKIE)?.value;
}

function languageNotice(page: Page): ReturnType<Page["getByRole"]> {
  return page.getByRole("region", {
    name: /Language suggestion|Sugerencia de idioma/,
  });
}

test.describe("aviso de idioma con el navegador en inglés", () => {
  test.use({ locale: "en-US", userAgent: BROWSER_USER_AGENT });

  test("sale en inglés en una página en español, sin redirigir (AC-001)", async ({
    page,
  }) => {
    const response = await page.goto(APP_URL);

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(languageNotice(page)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View in English" }),
    ).toBeVisible();
  });

  test("aceptar abre la página en inglés, con su búsqueda, y guarda la elección", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/?a=1`);
    await page.getByRole("button", { name: "View in English" }).click();

    await expect(page).toHaveURL(`${APP_URL}/en/?a=1`);
    await expect(languageNotice(page)).toHaveCount(0);
    expect(await readLanguageCookie(page)).toBeDefined();
  });

  test("quedarse oculta el aviso y sigue oculto al recargar y en otras páginas", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Stay on this page" }).click();

    await expect(page).toHaveURL(`${APP_URL}/`);
    await expect(languageNotice(page)).toHaveCount(0);
    await page.reload();
    await expect(languageNotice(page)).toHaveCount(0);
    await page.goto(COMPONENTS_URL);
    await expect(languageNotice(page)).toHaveCount(0);
  });

  test("con español guardado, la raíz abre en español y sin aviso", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Stay on this page" }).click();
    // Espera a que termine el envío antes de volver a navegar.
    await expect(languageNotice(page)).toHaveCount(0);
    await page.goto(APP_URL);

    expect(new URL(page.url()).pathname).toBe("/");
    await expect(languageNotice(page)).toHaveCount(0);
  });

  test("con inglés guardado, la raíz lleva a /en/ y otra dirección se respeta", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "View in English" }).click();
    await expect(page).toHaveURL(ENGLISH_HOME_URL);

    await page.goto(APP_URL);
    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    await page.goto(COMPONENTS_URL);
    expect(new URL(page.url()).pathname).toBe("/dev/componentes");
  });

  test("un buscador no recibe aviso ni redirección", async ({ browser }) => {
    const context = await browser.newContext({
      locale: "en-US",
      userAgent: GOOGLEBOT,
    });
    const page = await context.newPage();
    const response = await page.goto(APP_URL);

    expect(response?.status()).toBe(200);
    await expect(languageNotice(page)).toHaveCount(0);
    await context.close();
  });

  test("la respuesta declara Vary y no se guarda en caché compartida", async ({
    request,
  }) => {
    const response = await request.get(APP_URL, {
      headers: {
        "Accept-Language": "en-US",
        "User-Agent": BROWSER_USER_AGENT,
      },
    });

    expect(response.headers().vary).toContain("Accept-Language");
    expect(response.headers()["cache-control"]).toBe("private");
  });

  test("se recorre con el teclado", async ({ page }) => {
    await page.goto(APP_URL);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "View in English" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Stay on this page" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(languageNotice(page)).toHaveCount(0);
  });

  test("funciona sin JavaScript", async ({ browser }) => {
    const context = await browser.newContext({
      locale: "en-US",
      userAgent: BROWSER_USER_AGENT,
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "View in English" }).click();

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    await context.close();
  });

  test("axe no reporta violaciones con el aviso a la vista", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await expect(languageNotice(page)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
});

// El selector vive por ahora solo en la página de muestra (W3 lo pone en el
// header). Ahí se comprueba de punta a punta que cambiar de idioma guarda la
// elección.
test.describe("selector de idioma: guarda la elección", () => {
  test.use({ locale: "es-CO", userAgent: BROWSER_USER_AGENT });

  // El valor que escribe la cookie: el JSON del idioma, en base64.
  function decodeChoice(value: string | undefined): unknown {
    if (value === undefined) return undefined;
    return JSON.parse(
      Buffer.from(decodeURIComponent(value), "base64").toString("utf8"),
    );
  }

  test("al elegir inglés, la elección guardada pasa a ser inglés", async ({
    page,
  }) => {
    await page.goto(COMPONENTS_URL);
    expect(await readLanguageCookie(page)).toBeUndefined();

    await page.locator('[data-zone="dark"] nav a[lang="en"]').click();

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    expect(decodeChoice(await readLanguageCookie(page))).toBe("en");
  });

  test("al volver a español, la elección guardada pasa a ser español y la raíz ya no redirige", async ({
    page,
  }) => {
    await page.goto(COMPONENTS_URL);
    await page.locator('[data-zone="dark"] nav a[lang="en"]').click();
    await expect(page).toHaveURL(ENGLISH_HOME_URL);

    await page.goto(COMPONENTS_URL);
    await page.locator('[data-zone="dark"] nav a[lang="es"]').click();

    await expect(page).toHaveURL(`${APP_URL}/`);
    expect(decodeChoice(await readLanguageCookie(page))).toBe("es");
  });

  test("abrir el otro idioma en una pestaña nueva no cambia la elección", async ({
    page,
  }) => {
    await page.goto(COMPONENTS_URL);

    await page
      .locator('[data-zone="dark"] nav a[lang="en"]')
      .click({ modifiers: ["ControlOrMeta"] });

    expect(await readLanguageCookie(page)).toBeUndefined();
  });
});
