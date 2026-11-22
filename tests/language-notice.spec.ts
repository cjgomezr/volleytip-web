/**
 * Aviso de idioma (FR-005, AC-001): con el navegador en inglés aparece, se
 * acepta o se rechaza, y la elección se recuerda. Las capturas siguen las
 * mismas reglas que `ui.spec.ts`: solo la línea base de Linux obliga.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { shouldCreateMissingSnapshot } from "./support/missing-snapshot-policy";
import { snapshotCreatedNotice } from "./support/visual-baseline-notice";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const ENGLISH_HOME_URL = `${APP_URL}/en/`;
const COMPONENTS_URL = `${APP_URL}/dev/componentes`;
const LANGUAGE_COOKIE = "vt_locale";
const PAGE_MAX_DIFF_PIXELS = 20;
// Playwright anuncia "HeadlessChrome", que isbot reconoce como robot: sin un
// agente de navegador normal el aviso nunca saldría.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const SCREENSHOT_OPTIONS = {
  animations: "disabled",
  caret: "hide",
  scale: "css",
} as const;

const viewports = [
  { name: "small", width: 360, height: 800 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function createMissingLocalBaseline(
  name: string,
  capture: () => Promise<Buffer>,
): Promise<void> {
  const expectedPath = test.info().snapshotPath(name, { kind: "screenshot" });
  if (
    !shouldCreateMissingSnapshot(process.platform, existsSync(expectedPath))
  ) {
    return;
  }
  await mkdir(path.dirname(expectedPath), { recursive: true });
  await writeFile(expectedPath, await capture());
  console.log(snapshotCreatedNotice(name));
}

async function readLanguageCookie(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies(APP_URL);
  return cookies.find((cookie) => cookie.name === LANGUAGE_COOKIE)?.value;
}

function languageNotice(page: Page): ReturnType<Page["getByRole"]> {
  return page.getByRole("region", {
    name: /Language suggestion|Sugerencia de idioma/,
  });
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
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

for (const vp of viewports) {
  test.describe(`aviso de idioma @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    const cases = [
      { label: "es", locale: "en-US", url: APP_URL },
      { label: "en", locale: "es-CO", url: ENGLISH_HOME_URL },
    ] as const;

    for (const { label, locale, url } of cases) {
      test(`página en ${label} coincide con la línea base`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          locale,
          userAgent: BROWSER_USER_AGENT,
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();
        await page.goto(url);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const name = `aviso-idioma-${label}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
        expect(await hasHorizontalScroll(page)).toBe(false);
        await context.close();
      });
    }
  });
}
