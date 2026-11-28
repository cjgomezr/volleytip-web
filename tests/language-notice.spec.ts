/**
 * Aviso de idioma (FR-005, AC-001): con el navegador en inglés aparece, se
 * acepta o se rechaza, y la elección se recuerda. Las capturas del
 * aviso viven en `ui.spec.ts`, junto a las demás.
 */
import { waitForSettledPage } from "./support/page-ready";
import { test, expect, routeExternalRequests, type Page } from "./support/test";
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

  test("también sale en el 404, que lleva la cáscara", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/no-existe`);

    expect(response?.status()).toBe(404);
    await expect(languageNotice(page)).toBeVisible();
    await expect(page.locator("header")).toHaveCount(1);
  });

  test("aceptar abre la página en inglés, con su búsqueda, y guarda la elección", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/?a=1`);
    await waitForSettledPage(page);
    await page.getByRole("button", { name: "View in English" }).click();

    await expect(page).toHaveURL(`${APP_URL}/en/?a=1`);
    await expect(languageNotice(page)).toHaveCount(0);
    expect(await readLanguageCookie(page)).toBeDefined();
  });

  test("quedarse oculta el aviso y sigue oculto al recargar y en otras páginas", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await waitForSettledPage(page);
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
    await waitForSettledPage(page);
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
    await waitForSettledPage(page);
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
    await routeExternalRequests(context);
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

  test("se recorre con el teclado, con el enlace de salto primero", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Saltar al contenido" }),
    ).toBeFocused();
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
    await routeExternalRequests(context);
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

function switcherLink(
  page: Page,
  language: string,
): ReturnType<Page["locator"]> {
  return page.locator(`[data-zone="dark"] nav a[lang="${language}"]`);
}

// El valor que escribe la cookie: el JSON del idioma, en base64.
function decodeChoice(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(
    Buffer.from(decodeURIComponent(value), "base64").toString("utf8"),
  );
}

// El valor de la cookie con inglés guardado, tal como lo escribe el servidor.
const ENGLISH_CHOICE = encodeURIComponent(
  Buffer.from(JSON.stringify("en")).toString("base64"),
);

async function saveEnglishChoice(page: Page): Promise<void> {
  await page
    .context()
    .addCookies([
      { name: LANGUAGE_COOKIE, value: ENGLISH_CHOICE, url: APP_URL },
    ]);
}

/** Retiene el guardado de la elección hasta que se llame lo que devuelve. */
async function holdLanguageSave(page: Page): Promise<() => void> {
  let releaseSave = (): void => undefined;
  const saveIsHeld = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/idioma", async (route) => {
    await saveIsHeld;
    await route.continue();
  });
  return releaseSave;
}

test.describe("selector de idioma: guarda la elección", () => {
  test.use({ locale: "es-CO", userAgent: BROWSER_USER_AGENT });

  // Antes de que React tome la página, el selector es un enlace corriente y
  // un clic no guarda nada. Estas pruebas hablan del selector ya activo.
  async function openComponentsPage(page: Page): Promise<void> {
    await page.goto(COMPONENTS_URL);
    await waitForSettledPage(page);
  }

  test("al elegir inglés, la elección guardada pasa a ser inglés", async ({
    page,
  }) => {
    await openComponentsPage(page);
    expect(await readLanguageCookie(page)).toBeUndefined();

    await switcherLink(page, "en").click();

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    expect(decodeChoice(await readLanguageCookie(page))).toBe("en");
  });

  test("con inglés guardado, elegir español guarda español y lleva a la raíz", async ({
    page,
  }) => {
    await saveEnglishChoice(page);
    await openComponentsPage(page);

    await switcherLink(page, "es").click();

    await expect(page).toHaveURL(`${APP_URL}/`);
    expect(decodeChoice(await readLanguageCookie(page))).toBe("es");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  // Guardar la elección y cargar la página toman un momento. Si el selector
  // no reacciona al clic, parece que no funcionó.
  test("el selector marca el idioma elegido apenas se hace clic, antes de cambiar de página", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const releaseSave = await holdLanguageSave(page);

    try {
      await switcherLink(page, "en").click();

      await expect(switcherLink(page, "en")).toHaveAttribute(
        "aria-current",
        "true",
      );
      await expect(switcherLink(page, "es")).not.toHaveAttribute(
        "aria-current",
      );
      await expect(page).toHaveURL(COMPONENTS_URL);
    } finally {
      releaseSave();
    }

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("un segundo clic mientras se guarda el primero no cambia lo elegido", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const releaseSave = await holdLanguageSave(page);

    try {
      await switcherLink(page, "en").click();
      await switcherLink(page, "es").click();

      await expect(switcherLink(page, "en")).toHaveAttribute(
        "aria-current",
        "true",
      );
    } finally {
      releaseSave();
    }

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    expect(decodeChoice(await readLanguageCookie(page))).toBe("en");
  });

  test("al volver con el botón atrás, el selector marca el idioma de esa página", async ({
    page,
  }) => {
    await openComponentsPage(page);
    await switcherLink(page, "en").click();
    await expect(page).toHaveURL(ENGLISH_HOME_URL);

    await page.goBack();

    await expect(page).toHaveURL(COMPONENTS_URL);
    await expect(switcherLink(page, "es")).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(switcherLink(page, "en")).not.toHaveAttribute("aria-current");
  });

  test("si guardar la elección falla, igual cambia de página", async ({
    page,
  }) => {
    await openComponentsPage(page);
    await page.route("**/idioma", (route) => route.abort());

    await switcherLink(page, "en").click();

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("abrir el otro idioma en una pestaña nueva no cambia la elección", async ({
    page,
  }) => {
    await openComponentsPage(page);

    await switcherLink(page, "en").click({ modifiers: ["ControlOrMeta"] });

    expect(await readLanguageCookie(page)).toBeUndefined();
  });
});

test.describe("selector de idioma sin JavaScript", () => {
  test.use({
    locale: "es-CO",
    userAgent: BROWSER_USER_AGENT,
    javaScriptEnabled: false,
  });

  // Sin JavaScript el selector es un enlace y no guarda la elección. Con
  // inglés guardado, la raíz no puede devolver a /en/ a quien acaba de pedir
  // español desde el propio sitio: quedaría atrapado.
  test("con inglés guardado, elegir español abre la raíz en español", async ({
    page,
  }) => {
    await saveEnglishChoice(page);
    await page.goto(COMPONENTS_URL);

    await switcherLink(page, "es").click();

    await expect(page).toHaveURL(`${APP_URL}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("con inglés guardado, llegar a la raíz de fuera sigue llevando a /en/", async ({
    page,
  }) => {
    await saveEnglishChoice(page);

    await page.goto(APP_URL);

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
  });
});
