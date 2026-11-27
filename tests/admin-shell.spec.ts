/**
 * La cáscara del panel (#122): menú lateral, barra inferior, "Más", selector
 * de idioma y franja de mantenimiento. Casi todo se prueba en la página de
 * muestra (/dev/panel), que no usa la base; lo que guarda o pide sesión, en el
 * panel real. Las capturas viven en `ui.spec.ts`.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import { readProfileLocale } from "../src/testing/local-session";
import { readLocalSupabaseStatusOnce } from "./support/local-supabase-status-once";
import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const SIDEBAR_FROM_WIDTH = 768;
const SAMPLE_SECTIONS = 8;
const SECTIONS_OUTSIDE_BAR = 6;
const MAX_TAB_PRESSES = 40;
const FULL_BAR_PLACES = 5;
const FULL_BAR_BADGES = 3;
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
    more: "/dev/panel/mas",
    sections: "Secciones",
    mainSections: "Secciones principales",
  },
  {
    code: "en",
    shell: "/en/dev/panel",
    more: "/en/dev/panel/more",
    sections: "Sections",
    mainSections: "Main sections",
  },
] as const;

function bottomBar(page: Page): Locator {
  return page.getByRole("navigation", { name: "Secciones principales" });
}

// La cáscara pinta "Cerrar sesión" y el idioma dos veces y los estilos
// esconden una. En desarrollo la hoja puede tardar un instante: cada prueba
// nombra la región, para no encontrar las dos.
function signOutInMore(page: Page): Locator {
  return page.getByRole("main").getByRole("button", { name: "Cerrar sesión" });
}

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

/** Ningún texto de la cáscara se sale de la caja que lo contiene. */
async function expectNoOverflowingText(page: Page): Promise<void> {
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a, button, h1, p, span")]
      .filter(
        (element) =>
          element.checkVisibility() &&
          !element.closest(".sr-only") &&
          element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth + 1,
      )
      .map((element) => element.textContent),
  );
  expect(overflowing).toEqual([]);
}

async function expectTouchTargets(controls: Locator): Promise<void> {
  const all = await controls.all();
  expect(all.length).toBeGreaterThan(0);
  for (const control of all) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
}

async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
    await page.keyboard.press("Tab");
    const isFocused = await target.evaluate(
      (element) => element === document.activeElement,
    );
    if (isFocused) return;
  }
  throw new Error("Con el teclado no se llega al control");
}

async function expectAboveBar(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  const barBox = await bottomBar(page).boundingBox();
  expect(box).not.toBeNull();
  expect(barBox).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
    barBox?.y ?? 0,
  );
}

async function expectBadgesInsideTheirPlace(page: Page): Promise<void> {
  const outside = await page
    .locator('[data-panel-region="bottom-bar"] li')
    .evaluateAll((places) =>
      places.flatMap((place) => {
        const badge = place.querySelector("[data-panel-badge]");
        if (badge === null || !place.checkVisibility()) return [];
        const outer = place.getBoundingClientRect();
        const inner = badge.getBoundingClientRect();
        const isInside =
          inner.left >= outer.left && inner.right <= outer.right + 0.5;
        return isInside ? [] : [place.textContent];
      }),
    );
  expect(outside).toEqual([]);
}

for (const language of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    const hasSidebar = viewport.width >= SIDEBAR_FROM_WIDTH;

    test.describe(`cáscara ${language.code} @ ${viewport.width}`, () => {
      test.use({ viewport });

      for (const { name, path } of [
        { name: "muestra", path: language.shell },
        { name: "más", path: language.more },
        { name: "mantenimiento", path: `${language.shell}?mantenimiento=1` },
      ]) {
        test(`${name}: axe, sin desborde ni texto fuera de su caja`, async ({
          page,
        }) => {
          await page.goto(path);

          await expectNoOverflowingText(page);
          await expectAccessibleWithoutOverflow(page);
        });
      }

      test("pinta el menú que corresponde al ancho", async ({ page }) => {
        await page.goto(language.shell);

        const sidebar = page.getByRole("navigation", {
          name: language.sections,
          exact: true,
        });
        const bar = page.getByRole("navigation", {
          name: language.mainSections,
        });
        await expect(sidebar).toBeVisible({ visible: hasSidebar });
        await expect(bar).toBeVisible({ visible: !hasSidebar });
        if (hasSidebar) {
          await expect(sidebar.getByRole("link")).toHaveCount(SAMPLE_SECTIONS);
        } else {
          await expect(bar.getByRole("link")).toHaveCount(3);
          await expectTouchTargets(bar.getByRole("link"));
        }
        await expectTouchTargets(page.locator("button:visible"));
      });

      if (!hasSidebar) {
        test("con la barra llena, cada contador queda en su lugar", async ({
          page,
        }) => {
          await page.goto(`${language.shell}?barra=llena`);

          const bar = page.locator('[data-panel-region="bottom-bar"]');
          await expect(bar.getByRole("link")).toHaveCount(FULL_BAR_PLACES);
          await expect(bar.locator("[data-panel-badge]")).toHaveCount(
            FULL_BAR_BADGES,
          );
          await expectBadgesInsideTheirPlace(page);
          await expectAccessibleWithoutOverflow(page);
        });
      }

      test("la franja de mantenimiento se ve", async ({ page }) => {
        await page.goto(`${language.shell}?mantenimiento=1`);

        await expect(
          page.locator('[data-panel-region="maintenance"]'),
        ).toBeInViewport();
      });
    });
  }
}

test.describe("cáscara en celular", () => {
  // Bajita a propósito: "Más" no cabe y hay que bajar hasta el final.
  test.use({ viewport: { width: 360, height: 480 } });

  test("la barra queda fija y no tapa el final del contenido", async ({
    page,
  }) => {
    await page.goto("/dev/panel/mas");
    await expect(bottomBar(page)).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(bottomBar(page)).toBeInViewport();
    await expectAboveBar(page, signOutInMore(page));
  });

  test("'Más' lista lo que no está en la barra y 'Cerrar sesión'", async ({
    page,
  }) => {
    await page.goto("/dev/panel");

    await bottomBar(page).getByRole("link", { name: "Más" }).click();

    await expect(page).toHaveURL("/dev/panel/mas");
    const list = page.locator('[data-panel-region="more-list"]');
    await expect(list.getByRole("link")).toHaveCount(SECTIONS_OUTSIDE_BAR);
    await expect(signOutInMore(page)).toBeVisible();
  });

  test("con el teclado se llega a cada lugar sin que la barra tape el foco", async ({
    page,
  }) => {
    await page.goto("/dev/panel/mas");
    const team = page.getByRole("link", { name: "Equipo" });

    await tabUntilFocused(page, team);
    await expectAboveBar(page, team);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/dev/panel/equipo");
    const messages = bottomBar(page).getByRole("link", { name: /Mensajes/ });
    await tabUntilFocused(page, messages);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/dev/panel/mensajes");
    await expect(messages).toHaveAttribute("aria-current", "page");
  });
});

test.describe("cáscara en computador", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("el menú se recorre con el teclado y marca el actual", async ({
    page,
  }) => {
    await page.goto("/dev/panel");
    const team = page.getByRole("link", { name: "Equipo" });

    await tabUntilFocused(page, team);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/dev/panel/equipo");
    await expect(team).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Equipo");
  });

  test("el contador sale en la entrada del módulo", async ({ page }) => {
    await page.goto("/dev/panel");

    await expect(
      page.getByRole("link", { name: /Mensajes.*3 pendientes/ }),
    ).toBeVisible();
  });
});

for (const javaScriptEnabled of [true, false]) {
  test.describe(`idioma del panel ${javaScriptEnabled ? "con" : "sin"} JavaScript`, () => {
    test.use({ javaScriptEnabled });

    test("pasa a la misma pantalla y lo guarda en el perfil", async ({
      page,
      signInToPanel,
    }) => {
      const { userId } = await signInToPanel({ role: "admin" });
      await page.goto("/admin/mas");

      await page
        .getByRole("complementary")
        .getByRole("button", { name: "English" })
        .click();

      await expect(page).toHaveURL("/en/admin/more");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(
        page.getByRole("heading", { level: 1, name: "More" }),
      ).toBeVisible();
      expect(
        await readProfileLocale(readLocalSupabaseStatusOnce(), userId),
      ).toBe("en");
    });
  });
}

// Sin nombre: en la cáscara sale el correo, que es lo más largo.
for (const viewport of VIEWPORTS) {
  for (const { path, more } of [
    { path: "/admin", more: "/admin/mas" },
    { path: "/en/admin", more: "/en/admin/more" },
  ]) {
    test.describe(`panel real ${path} @ ${viewport.width}`, () => {
      test.use({ viewport });

      test("axe, sin desborde ni texto fuera de su caja", async ({
        page,
        signInToPanel,
      }) => {
        await signInToPanel({ role: "admin" });

        for (const url of [path, more]) {
          await page.goto(url);
          await expectNoOverflowingText(page);
          await expectAccessibleWithoutOverflow(page);
        }
      });
    });
  }
}

test.describe("panel real", () => {
  test("un segundo clic en el idioma no envía otro cambio", async ({
    page,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });
    await page.goto("/admin");
    // El envío se detiene hasta que la prueba lo suelta.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submissions = 0;
    await page.route("**/admin/idioma.data*", async (route) => {
      submissions += 1;
      await held;
      await route.continue();
    });
    const english = page
      .getByRole("complementary")
      .getByRole("button", { name: "English" });
    // Sin hidratar, el clic sería un envío del navegador.
    await page.waitForLoadState("networkidle");

    await english.click();
    await expect(english).toHaveAttribute("aria-disabled", "true");
    await english.click({ force: true });
    release();

    await expect(page).toHaveURL("/en/admin");
    expect(submissions).toBe(1);
  });

  test("el menú tiene las secciones que existen, con Resumen como actual", async ({
    page,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });

    await page.goto("/admin");

    const links = page
      .getByRole("navigation", { name: "Secciones", exact: true })
      .getByRole("link");
    // Mensajes lleva además su número, que depende de lo que haya en la base.
    await expect(links).toHaveText([
      "Resumen",
      /^Mensajes/,
      "Textos del sitio",
      "Idiomas y mercados",
      "Ajustes",
      "Bitácora",
    ]);
    await expect(links.first()).toHaveAttribute("aria-current", "page");
    await expect(links.nth(1)).not.toHaveAttribute("aria-current");
    await expect(links.last()).not.toHaveAttribute("aria-current");
  });

  test("un staff no ve la cáscara", async ({ page, signInToPanel }) => {
    await signInToPanel({ role: "staff" });

    await page.goto("/admin/mas");

    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
});
