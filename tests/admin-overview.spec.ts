/**
 * El resumen del panel (#124). Los estados se prueban en la página de muestra
 * (/dev/panel?resumen=...), que no usa la base y no cambia entre corridas; lo
 * que depende de la sesión, en el panel real. Las capturas viven en
 * `ui.spec.ts`.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const BASE_CARDS = 3;
const RECENT_ENTRIES = 10;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const LANGUAGES = [
  {
    code: "es",
    shell: "/dev/panel",
    panel: "/admin",
    inboxSection: "mensajes",
    greeting: "Hola, Andrés Gómez",
    messages: /Mensajes sin responder/,
    inbox: "/dev/panel/mensajes?estado=new",
    activity: "Actividad reciente",
    empty: "Todavía no hay actividad.",
    failed: "No se pudo cargar este dato.",
    retry: "Reintentar",
  },
  {
    code: "en",
    shell: "/en/dev/panel",
    panel: "/en/admin",
    inboxSection: "messages",
    greeting: "Hi, Andrés Gómez",
    messages: /Unanswered messages/,
    inbox: "/en/dev/panel/messages?estado=new",
    activity: "Recent activity",
    empty: "There is no activity yet.",
    failed: "Could not load this number.",
    retry: "Try again",
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

/** Ningún texto del resumen se sale de la caja que lo contiene. */
async function expectNoOverflowingText(page: Page): Promise<void> {
  const overflowing = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "main :is(a, h1, h2, p, span, time, dt, dd)",
      ),
    ]
      .filter(
        (element) =>
          element.checkVisibility() &&
          element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth + 1,
      )
      .map((element) => element.textContent),
  );
  expect(overflowing).toEqual([]);
}

for (const language of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`resumen ${language.code} @ ${viewport.width}`, () => {
      test.use({ viewport });

      for (const state of ["datos", "vacio", "fallo"]) {
        test(`${state}: axe, sin desborde ni texto fuera de su caja`, async ({
          page,
        }) => {
          await page.goto(`${language.shell}?resumen=${state}`);

          await expect(
            page.getByRole("heading", { level: 1, name: language.greeting }),
          ).toBeVisible();
          await expectNoOverflowingText(page);
          await expectAccessibleWithoutOverflow(page);
        });
      }

      test("con datos pinta las tarjetas y las diez entradas", async ({
        page,
      }) => {
        await page.goto(`${language.shell}?resumen=datos`);

        await expect(page.locator("[data-overview-card]")).toHaveCount(
          BASE_CARDS,
        );
        await expect(
          page.getByRole("region", { name: language.activity }).locator("time"),
        ).toHaveCount(RECENT_ENTRIES);
      });

      test("vacío: ceros, aviso de actividad y ninguna tarjeta enlaza", async ({
        page,
      }) => {
        await page.goto(`${language.shell}?resumen=vacio`);

        await expect(page.locator("[data-overview-value]")).toHaveText([
          "0",
          "0",
          "0",
        ]);
        await expect(page.getByText(language.empty)).toBeVisible();
        await expect(page.getByRole("main").getByRole("link")).toHaveCount(0);
      });

      test("si falla una consulta, su tarjeta lo dice y las demás salen", async ({
        page,
      }) => {
        await page.goto(`${language.shell}?resumen=fallo`);

        await expect(page.getByText(language.failed)).toBeVisible();
        await expect(page.locator("[data-overview-value]")).toHaveCount(
          BASE_CARDS - 1,
        );
        const retry = page.getByRole("link", { name: language.retry });
        const box = await retry.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        await retry.click();
        await expect(page).toHaveURL(`${language.shell}?resumen=fallo`);
      });

      test("con el teclado, la tarjeta de mensajes abre la bandeja filtrada", async ({
        page,
      }) => {
        await page.goto(`${language.shell}?resumen=datos`);
        const card = page
          .getByRole("main")
          .getByRole("link", { name: language.messages });
        const box = await card.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);

        await card.focus();
        await page.keyboard.press("Enter");

        await expect(page).toHaveURL(language.inbox);
      });

      test("el resumen real saluda y pasa axe", async ({
        page,
        signInToPanel,
      }) => {
        await signInToPanel({ role: "admin", fullName: "Andrés Gómez" });

        await page.goto(language.panel);

        await expect(
          page.getByRole("heading", {
            level: 1,
            name: language.greeting,
          }),
        ).toBeVisible();
        await expect(page.locator("[data-overview-value]")).toHaveCount(
          BASE_CARDS,
        );
        // Solo la de mensajes tiene a dónde llevar.
        await expect(page.locator("[data-overview-card] a")).toHaveAttribute(
          "href",
          `${language.panel}/${language.inboxSection}?estado=new`,
        );
        await expectNoOverflowingText(page);
        await expectAccessibleWithoutOverflow(page);
      });
    });
  }
}
