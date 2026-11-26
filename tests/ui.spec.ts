/**
 * Visual regression + accessibility gate.
 *
 * - toHaveScreenshot() compares pixel-by-pixel against an approved baseline.
 *   Only the Linux baseline (tests/ui.spec.ts-snapshots/*-linux.png) is
 *   versioned and binding. On Linux (e.g. the factory worker), generate or
 *   update it the usual way: npx playwright test --update-snapshots, then
 *   commit the PNG like any other file. On every PR,
 *   .github/workflows/visual-baselines.yml only COMPARES: it never
 *   regenerates, commits or pushes, so a red check always lands on the PR's
 *   real HEAD and the diff is left as the visual-diff artifact for a person
 *   to look at. Accepting a new baseline is a separate, deliberate act: a
 *   human runs that workflow by hand against the PR's branch. The baseline
 *   still only ever comes from one place, which is what stops two UI PRs in
 *   parallel from fighting over the same binary file.
 *
 * - On any other platform (Windows, macOS) there is no versioned baseline:
 *   *-win32.png is gitignored. The first local run creates one and every run
 *   after that compares against it, but it's local and nobody reviewed it,
 *   so it's informative only, not what decides whether a PR passes. The
 *   command says so itself (see tests/support/visual-baseline-notice.ts,
 *   wired as globalSetup in playwright.config.ts). That first run does NOT
 *   fail for the snapshots it had to create: it names each one and carries
 *   on. A snapshot that already exists and differs still fails.
 *
 * - AxeBuilder runs automated accessibility checks (contrast, labels, etc.).
 *   Requires: npm i -D @axe-core/playwright
 *
 * - REQUIRED in playwright.config.ts: a `webServer` block with
 *   `reuseExistingServer` off by default, so the suite boots its own dev
 *   server and never adopts one that belongs to another project answering on
 *   the same port. The Stop hook runs `npx playwright test` standalone;
 *   without webServer every test dies with ERR_CONNECTION_REFUSED and blocks
 *   the session for a reason unrelated to the code.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./support/panel-session";
import {
  expect,
  routeExternalRequests,
  waitForImages,
  type Page,
} from "./support/test";
import AxeBuilder from "@axe-core/playwright";

import { ANNOUNCEMENT_FIXTURES } from "./support/site-fixtures";
import { shouldCreateMissingSnapshot } from "./support/missing-snapshot-policy";
import { snapshotCreatedNotice } from "./support/visual-baseline-notice";
import { TEST_ENV } from "./support/test-env";

// Con qué condiciones se toma cada captura, sembrada o comparada. Hoy
// coinciden con los valores por defecto de toHaveScreenshot, pero se pasan a
// mano y a los dos lados a propósito: la captura sembrada la compara la
// propia corrida un instante después, así que si un día Playwright cambiara
// un default, la semilla y la comparación dejarían de salir de las mismas
// condiciones y la primera corrida volvería a fallar, esta vez disfrazada de
// regresión visual.
const SCREENSHOT_OPTIONS = {
  animations: "disabled",
  caret: "hide",
  scale: "css",
} as const;

/**
 * Escribe la captura local que falte, ANTES de compararla.
 *
 * Fuera de Linux no hay línea base versionada, así que la primera corrida de
 * un checkout limpio no tiene con qué comparar. Playwright escribe la captura
 * que falta y aun así hunde el test (con `updateSnapshots: 'missing'`, que es
 * su valor por defecto, devuelve un `softError`): las capturas recién creadas
 * se leían como otras tantas regresiones visuales, y el remedio, correr
 * Playwright dos veces, no estaba escrito en ninguna parte.
 *
 * El matcher corre igual, siempre. En la corrida que siembra compara contra la
 * foto recién tomada, así que ahí sólo puede fallar si la página no estaba
 * quieta; de la siguiente en adelante compara de verdad. Una captura que ya
 * existe no se toca, ni aquí ni en Linux.
 *
 * De lo que depende que la semilla sea buena: `toHaveScreenshot` reintenta
 * hasta que dos capturas seguidas coinciden, y esto toma una sola. Que valga
 * se apoya en que las animaciones van desactivadas y en que ya se esperó a
 * `document.fonts.ready`. Quien meta una entrada animada en la página tendrá
 * que mirar aquí antes de preguntarse por qué la primera corrida se puso
 * caprichosa.
 */
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

// Filled by /bootstrap with this project's own port. Never hardcode 3000:
// every factory on the machine would fight over it and test each other's app.
const APP_URL = process.env.APP_URL ?? "http://localhost:3740";

// Playwright pide inglés por defecto, y sin elección guardada el aviso de
// idioma saldría en la home y en sus capturas. Estas pruebas corren como una
// persona que ya eligió español (valor que escribe `serializeLanguageChoice`:
// el JSON "es" en base64); las del aviso (language-notice.spec.ts) parten de
// una primera visita.
test.use({
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

// Presupuesto ABSOLUTO, no un ratio. Un `maxDiffPixelRatio` crece con el alto
// de la página, así que en una página larga un componente pequeño puede
// cambiar por completo sin llegar al umbral: un botón desalineado, un color de
// acento equivocado o un icono que no carga caben todos dentro del 1%. Con un
// número fijo, el presupuesto no depende de cuánto scroll tenga la página.
//
// El 20 es un punto de partida, no una medida de TU proyecto. Para fijarlo con
// datos: pon esto a 0, abre un PR sin cambios visuales y deja que el workflow
// compare dos veces; lo que reporte es el ruido real de tu render en CI. Si
// reporta 0, como es lo normal en un runner estable, cualquier número pequeño
// sirve y este vale. Si reporta más, súbelo hasta pasar el ruido y no más.
const PAGE_MAX_DIFF_PIXELS = 20;

const viewports = [
  { name: "small", width: 360, height: 800 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const vp of viewports) {
  test.describe(`home @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("matches approved baseline", async ({ page }) => {
      await page.goto(APP_URL);
      // networkidle nunca llega mientras el dev server compila bajo carga paralela.
      // Lo que de verdad mueve píxeles son las fuentes, y toHaveScreenshot ya
      // reintenta hasta que la página deja de cambiar.
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await waitForImages(page);
      const name = `home-${vp.name}.png`;
      await createMissingLocalBaseline(name, () =>
        page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
      );
      await expect(page).toHaveScreenshot(name, {
        ...SCREENSHOT_OPTIONS,
        fullPage: true,
        maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
      });
    });

    test("has no horizontal scroll", async ({ page }) => {
      await page.goto(APP_URL);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${vp.width}px`).toBe(false);
    });
  });
}

test("has no accessibility violations (axe-core)", async ({ page }) => {
  await page.goto(APP_URL);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
});

// ---------------------------------------------------------------------------
// Página de muestra de los componentes base (/dev/componentes)
// ---------------------------------------------------------------------------

const COMPONENTS_URL = `${APP_URL}/dev/componentes`;
// Los tokens de src/app.css tal como los devuelve el navegador.
const BRAND_LIME = "rgb(205, 249, 128)";
const BRAND_NIGHT = "rgb(20, 10, 53)";
const BRAND_RED = "rgb(252, 0, 53)";
const BRAND_MIST = "rgb(217, 230, 232)";
const BRAND_RED_DEEP = "rgb(176, 0, 42)";
const FOCUS_RING_COLOR = { dark: BRAND_LIME, light: BRAND_NIGHT } as const;
const FOCUS_RING_WIDTH = "3px";
const MIN_TOUCH_TARGET_PX = 44;
// Los navegadores redondean posiciones a fracciones de píxel.
const SUBPIXEL_TOLERANCE_PX = 0.5;

const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_WIDGET_HEIGHT_PX = 65;

interface TurnstileCall {
  readonly method: string;
  readonly sitekey?: string;
  readonly appearance?: string;
}

/**
 * Las llamadas que la página le hizo al Turnstile de mentira que reciben
 * todas las pruebas (`tests/support/test.ts`).
 */
async function readTurnstileCalls(page: Page): Promise<TurnstileCall[]> {
  return page.evaluate(
    () =>
      (window as unknown as { turnstileCalls?: TurnstileCall[] })
        .turnstileCalls ?? [],
  );
}

async function openComponentsPage(page: Page): Promise<void> {
  await page.goto(COMPONENTS_URL);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

interface FocusRing {
  readonly zone: string | undefined;
  readonly color: string;
  readonly width: string;
  readonly offset: string;
}

async function readFocusRing(page: Page): Promise<FocusRing> {
  return page.evaluate(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) {
      throw new Error("Ningún elemento tiene el foco");
    }
    const styles = getComputedStyle(focused);
    return {
      zone: focused.closest<HTMLElement>("[data-zone]")?.dataset.zone,
      color: styles.outlineColor,
      width: styles.outlineWidth,
      offset: styles.outlineOffset,
    };
  });
}

for (const vp of viewports) {
  test.describe(`componentes @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("coincide con la línea base aprobada", async ({ page }) => {
      await openComponentsPage(page);
      const name = `componentes-${vp.name}.png`;
      await createMissingLocalBaseline(name, () =>
        page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
      );
      await expect(page).toHaveScreenshot(name, {
        ...SCREENSHOT_OPTIONS,
        fullPage: true,
        maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
      });
    });

    test("no tiene scroll horizontal", async ({ page }) => {
      await openComponentsPage(page);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow, `scroll horizontal a ${vp.width}px`).toBe(false);
    });

    test("axe no reporta violaciones", async ({ page }) => {
      await openComponentsPage(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([]);
    });

    test("texto largo: ningún componente se sale de su caja", async ({
      page,
    }) => {
      await openComponentsPage(page);
      const escaped = await page.evaluate((tolerance) => {
        const boxes = [...document.querySelectorAll("[data-long-text]")];
        return boxes.flatMap((box, index) => {
          const limit = box.getBoundingClientRect();
          const overflowing = [...box.querySelectorAll("*")].filter(
            (element) => {
              // Un elemento que no se pinta (los avisos 2 y 3 de la barra en
              // celular) no tiene caja: no puede salirse de la suya.
              if (element.getClientRects().length === 0) return false;
              const rect = element.getBoundingClientRect();
              return (
                rect.right > limit.right + tolerance ||
                rect.left < limit.left - tolerance
              );
            },
          );
          const scrolls = box.scrollWidth > box.clientWidth;
          return overflowing.length > 0 || scrolls ? [`caja ${index}`] : [];
        });
      }, SUBPIXEL_TOLERANCE_PX);

      expect(await page.locator("[data-long-text]").count()).toBeGreaterThan(0);
      expect(escaped).toEqual([]);
    });

    test("cada botón de ícono mide 44 por 44 px o más", async ({ page }) => {
      await openComponentsPage(page);
      const iconButtons = page.getByRole("button", { name: "Cerrar" });
      const count = await iconButtons.count();

      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const box = await iconButtons.nth(index).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
        expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      }
    });
  });
}

test.describe("estados de foco", () => {
  test("con teclado, cada botón muestra el anillo del color de su zona", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const focusable = page.locator(
      "[data-zone] a[href], [data-zone] button:not([disabled]), [data-zone] input:not([disabled])",
    );
    const expectedStops = await focusable.count();
    const seenZones = new Set<string>();

    // Sin transiciones, para leer el color final del anillo y no uno a medio
    // camino.
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Con Tab y no con `focus()`: el anillo solo aparece cuando el foco
    // llega por teclado.
    for (let stop = 0; stop < expectedStops; stop += 1) {
      await page.keyboard.press("Tab");
      const ring = await readFocusRing(page);
      const zone = ring.zone === "light" ? "light" : "dark";
      seenZones.add(zone);
      expect(ring.color, `parada ${stop}, zona ${zone}`).toBe(
        FOCUS_RING_COLOR[zone],
      );
      expect(ring.width).toBe(FOCUS_RING_WIDTH);
      expect(ring.offset).toBe(FOCUS_RING_WIDTH);
    }

    expect([...seenZones].sort()).toEqual(["dark", "light"]);
  });
});

test.describe("Campo de texto", () => {
  test("mide lo que dice la tabla y la etiqueta queda a 6 px", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const field = page
      .locator('[data-zone="light"]')
      .getByLabel("Correo electrónico")
      .first();

    const measured = await field.evaluate((input) => {
      const styles = getComputedStyle(input);
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label === null) {
        throw new Error("El campo no tiene etiqueta");
      }
      const labelStyles = getComputedStyle(label);
      return {
        height: input.getBoundingClientRect().height,
        radius: styles.borderRadius,
        borderWidth: styles.borderTopWidth,
        borderColor: styles.borderTopColor,
        background: styles.backgroundColor,
        fontSize: styles.fontSize,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        labelDisplay: labelStyles.display,
        labelFontSize: labelStyles.fontSize,
        labelFontWeight: labelStyles.fontWeight,
        gap:
          input.getBoundingClientRect().top -
          label.getBoundingClientRect().bottom,
      };
    });

    expect(measured).toEqual({
      height: 52,
      radius: "12px",
      borderWidth: "2px",
      borderColor: BRAND_NIGHT,
      background: "rgb(255, 255, 255)",
      fontSize: "16px",
      paddingLeft: "16px",
      paddingRight: "16px",
      labelDisplay: "block",
      labelFontSize: "14px",
      labelFontWeight: "700",
      gap: 6,
    });
  });

  test("hacer clic en la etiqueta enfoca el campo", async ({ page }) => {
    await openComponentsPage(page);
    const zone = page.locator('[data-zone="dark"]');
    const field = zone.getByLabel("Correo electrónico").first();

    await zone.locator("label").first().click();

    await expect(field).toBeFocused();
  });

  test("con error se anuncia inválido y describe su mensaje", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const field = page.locator('[data-zone="light"] input[name="error"]');

    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription("Escribe un correo válido");
  });

  test("con ayuda y error describe los dos", async ({ page }) => {
    await openComponentsPage(page);
    const field = page.locator('[data-zone="light"] input[name="hint-error"]');

    await expect(field).toHaveAccessibleDescription(
      "Ahí te enviamos la confirmación Escribe un correo válido",
    );
  });

  test("en zona clara el error va en rojo profundo; en oscura, en rojo", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const readErrorColor = (zone: string): Promise<string> =>
      page
        .locator(`[data-zone="${zone}"]`)
        .getByText("Escribe un correo válido")
        .first()
        .evaluate((message) => getComputedStyle(message).color);

    expect(await readErrorColor("light")).toBe(BRAND_RED_DEEP);
    expect(await readErrorColor("dark")).toBe(BRAND_RED);
  });
});

test.describe("Campo de texto: bordes", () => {
  const BORDERS = [
    { zone: "dark", name: "normal", color: BRAND_NIGHT },
    { zone: "dark", name: "hover", color: BRAND_LIME },
    { zone: "dark", name: "error", color: BRAND_RED },
    { zone: "light", name: "normal", color: BRAND_NIGHT },
    // En zona clara el hover no cambia el color: engrosa el borde.
    { zone: "light", name: "hover", color: BRAND_NIGHT },
    { zone: "light", name: "error", color: BRAND_RED_DEEP },
  ] as const;

  for (const { zone, name, color } of BORDERS) {
    test(`en zona ${zone}, el campo "${name}" tiene su borde`, async ({
      page,
    }) => {
      await openComponentsPage(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const field = page.locator(`[data-zone="${zone}"] input[name="${name}"]`);

      const borderColor = await field.evaluate(
        (input) => getComputedStyle(input).borderTopColor,
      );

      expect(borderColor).toBe(color);
    });
  }
});

test.describe("Campo de texto: hover en zona clara", () => {
  test("el borde se engrosa hacia adentro; en reposo no", async ({ page }) => {
    await openComponentsPage(page);
    const readShadow = (name: string): Promise<string> =>
      page
        .locator(`[data-zone="light"] input[name="${name}"]`)
        .evaluate((input) => getComputedStyle(input).boxShadow);

    expect(await readShadow("normal")).not.toContain("inset");
    expect(await readShadow("hover")).toContain("inset");
    expect(await readShadow("hover")).toContain(BRAND_NIGHT);
  });
});

test.describe("Botón", () => {
  test("deshabilitado y en envío no disparan el clic; activo sí", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const counter = page.getByTestId("click-count");
    const enabled = page.getByRole("button", { name: "Contar un clic" });

    // El primer clic puede caer antes de que React tome la página.
    await expect(async () => {
      await enabled.click();
      await expect(counter).not.toHaveText("Clics recibidos: 0", {
        timeout: 500,
      });
    }).toPass();
    const countAfterEnabled = await counter.textContent();

    await page
      .getByRole("button", { name: "No cuenta: deshabilitado" })
      .click({ force: true });
    // `force` en los dos: Playwright se niega a hacer clic en un control
    // deshabilitado, y aquí se quiere comprobar qué pasa si el clic llega.
    await page
      .getByRole("button", { name: "No cuenta: enviando" })
      .click({ force: true });

    await expect(counter).toHaveText(countAfterEnabled ?? "");
  });

  // Al presionar, el puntero sigue encima: valen a la vez el hover y el
  // activo. Tiene que ganar el activo, y eso depende del orden en que
  // src/app.css declara las variantes.
  test("con el puntero: lima al pasar por encima y niebla al presionar", async ({
    page,
  }) => {
    await openComponentsPage(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const primary = page
      .locator('[data-zone="dark"]')
      .getByRole("button", { name: "Agregar al carrito" })
      .first();
    const readBackground = (): Promise<string> =>
      primary.evaluate((button) => getComputedStyle(button).backgroundColor);

    expect(await readBackground()).toBe(BRAND_RED);

    await primary.hover();
    expect(await readBackground()).toBe(BRAND_LIME);

    await page.mouse.down();
    expect(await readBackground()).toBe(BRAND_MIST);

    await page.mouse.up();
    expect(await readBackground()).toBe(BRAND_LIME);
  });

  test("en envío conserva el foco y anuncia el estado", async ({ page }) => {
    await openComponentsPage(page);
    const submitting = page.getByRole("button", {
      name: "No cuenta: enviando",
    });

    await submitting.focus();

    await expect(submitting).toBeFocused();
    await expect(submitting).toHaveAttribute("aria-disabled", "true");
    await expect(submitting).toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByRole("status").filter({ hasText: "Enviando" }).first(),
    ).toBeAttached();
  });
});

test.describe("Formulario protegido", () => {
  const HONEYPOT = 'input[name="website"]';
  const TAB_PRESSES_LIMIT = 200;

  test("pinta el widget de Turnstile con la llave de sitio", async ({
    page,
  }) => {
    await openComponentsPage(page);

    await expect
      .poll(() => readTurnstileCalls(page))
      .toEqual([
        {
          method: "render",
          sitekey: TURNSTILE_TEST_SITE_KEY,
          appearance: "interaction-only",
        },
      ]);
  });

  test("el widget solo ocupa espacio cuando hay que tocarlo", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const form = page.locator("form", { has: page.locator(HONEYPOT) });
    // Lo que separa el último campo del botón: sin widget, una sola
    // separación del formulario.
    const measureSpaceBeforeButton = (): Promise<number> =>
      form.evaluate((element) => {
        const field = element.querySelector("input[name='email']");
        const button = element.querySelector("button[type='submit']");
        const fieldBlock = field?.closest("form > *");
        if (!fieldBlock || !button)
          throw new Error("Falta el campo o el botón");
        return (
          button.getBoundingClientRect().top -
          fieldBlock.getBoundingClientRect().bottom
        );
      });
    const rowGap = await form.evaluate((element) =>
      parseFloat(getComputedStyle(element).rowGap),
    );
    await expect.poll(() => readTurnstileCalls(page)).toHaveLength(1);

    expect(await measureSpaceBeforeButton()).toBeCloseTo(rowGap, 0);

    await page.evaluate(() => {
      (
        window as unknown as { requireTurnstileInteraction: () => void }
      ).requireTurnstileInteraction();
    });

    await expect
      .poll(measureSpaceBeforeButton)
      .toBeGreaterThanOrEqual(2 * rowGap + TURNSTILE_WIDGET_HEIGHT_PX);
  });

  test("lleva la marca de tiempo firmada en un campo oculto", async ({
    page,
  }) => {
    await openComponentsPage(page);

    const timestamp = page.locator('input[name="form_started_at"]');
    await expect(timestamp).toHaveAttribute("type", "hidden");
    await expect(timestamp).toHaveValue(/^\d+\.[\w-]+$/);
  });

  test("el campo trampa existe pero no se ve", async ({ page }) => {
    await openComponentsPage(page);

    const honeypot = page.locator(HONEYPOT);
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).not.toBeInViewport();
    const box = await honeypot.boundingBox();
    expect(box === null || box.x + box.width < 0).toBe(true);
  });

  test("los lectores de pantalla solo encuentran el campo del correo", async ({
    page,
  }) => {
    await openComponentsPage(page);

    const form = page.locator("form", { has: page.locator(HONEYPOT) });
    await expect(form.getByRole("textbox")).toHaveCount(1);
    await expect(form.getByRole("textbox")).toHaveAttribute("name", "email");
  });

  test("con el teclado nunca se llega al campo trampa", async ({ page }) => {
    await openComponentsPage(page);
    const visited: string[] = [];

    for (let press = 0; press < TAB_PRESSES_LIMIT; press += 1) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(
        () => document.activeElement?.getAttribute("name") ?? "",
      );
      visited.push(name);
      if (visited.filter((seen) => seen === "email").length > 1) {
        break;
      }
    }

    expect(visited, "el recorrido pasa por el formulario").toContain("email");
    expect(visited).not.toContain("website");
  });
});

// ---------------------------------------------------------------------------
// Home en inglés (/en/): misma página, textos de otro idioma.
// ---------------------------------------------------------------------------

const ENGLISH_HOME_URL = `${APP_URL}/en/`;

for (const vp of viewports) {
  test.describe(`home en inglés @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("coincide con la línea base aprobada", async ({ page }) => {
      await page.goto(ENGLISH_HOME_URL);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await waitForImages(page);
      const name = `home-en-${vp.name}.png`;
      await createMissingLocalBaseline(name, () =>
        page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
      );
      await expect(page).toHaveScreenshot(name, {
        ...SCREENSHOT_OPTIONS,
        fullPage: true,
        maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
      });
    });
  });
}

test.describe("home en inglés", () => {
  test("axe no reporta violaciones", async ({ page }) => {
    await page.goto(ENGLISH_HOME_URL);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });

  test("al navegar de español a inglés sin recargar, cambian el idioma y los textos", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Aprende voley en",
    );

    // Navegación dentro de la app, como la que hará el selector de idioma:
    // sin pedir el documento de nuevo.
    await page.evaluate(() => {
      const { __reactRouterDataRouter: router } = window as unknown as {
        __reactRouterDataRouter: { navigate: (to: string) => Promise<void> };
      };
      return router.navigate("/en/");
    });

    await expect(page).toHaveURL(ENGLISH_HOME_URL);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Learn volleyball in",
    );
    await expect(page).toHaveTitle("VolleyTip");
  });

  test("el navegador retoma el texto del servidor sin advertencias de hidratación", async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (/hydrat/i.test(message.text())) warnings.push(message.text());
    });
    await page.goto(ENGLISH_HOME_URL);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Learn volleyball in",
    );
    expect(warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Selector de idioma (FR-004)
// ---------------------------------------------------------------------------

// El servidor de las pruebas corre con este dominio, distinto de la
// dirección donde se le pide.
const TEST_SITE_ORIGIN = TEST_ENV.SITE_ORIGIN;

test.describe("Selector de idioma", () => {
  const ZONE_NAMES = ["dark", "light"] as const;

  for (const zone of ZONE_NAMES) {
    test(`en zona ${zone}, cada enlace mide 44 px o más de alto`, async ({
      page,
    }) => {
      await openComponentsPage(page);
      const links = page.locator(`[data-zone="${zone}"] nav a[hreflang]`);

      await expect(links).toHaveCount(2);
      for (const link of await links.all()) {
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      }
    });
  }

  test("marca el idioma actual y nombra cada idioma en ese idioma", async ({
    page,
  }) => {
    await openComponentsPage(page);
    const switcher = page.locator('[data-zone="dark"] nav').first();

    await expect(switcher.locator('a[aria-current="true"]')).toHaveText(
      "Español",
    );
    await expect(switcher.locator('a[lang="en"]')).toHaveText("English");
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("el enlace lleva a la página en el otro idioma", async ({ page }) => {
      await page.goto(COMPONENTS_URL);
      await page.locator('[data-zone="dark"] nav a[lang="en"]').click();

      await expect(page).toHaveURL(/\/en\/$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  });

  test("la home declara su canónica y sus versiones con el dominio del entorno", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/en/?talla=m`);
    const head = page.locator("head");

    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${TEST_SITE_ORIGIN}/en/`,
    );
    await expect(head.locator('link[rel="alternate"][hreflang]')).toHaveCount(
      3,
    );
    await expect(
      head.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveAttribute("href", `${TEST_SITE_ORIGIN}/`);
  });

  test("al cambiar de idioma sin recargar, la canónica cambia con la página", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.waitForFunction(() => "__reactRouterDataRouter" in window);
    await page.evaluate(() => {
      const router = (
        window as unknown as {
          __reactRouterDataRouter: { navigate: (to: string) => Promise<void> };
        }
      ).__reactRouterDataRouter;
      return router.navigate("/en/");
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${TEST_SITE_ORIGIN}/en/`,
    );
  });
});

// ---------------------------------------------------------------------------
// Aviso de idioma (lo demás está en language-notice.spec.ts)
// ---------------------------------------------------------------------------

// Playwright anuncia "HeadlessChrome", que isbot reconoce como robot: sin un
// agente de navegador normal el aviso nunca saldría.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FIRST_VISIT = { cookies: [], origins: [] };
const OVERFLOW_SETTLE_MS = 5_000;
const LANGUAGE_NOTICE_NAME = /Language suggestion|Sugerencia de idioma/;

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
        // Un contexto nuevo hereda la cookie de "ya elegí español" que este
        // archivo pone para las demás pruebas, y con ella el aviso no sale.
        // Estas parten de una primera visita.
        const context = await browser.newContext({
          locale,
          userAgent: BROWSER_USER_AGENT,
          viewport: { width: vp.width, height: vp.height },
          storageState: FIRST_VISIT,
        });
        await routeExternalRequests(context);
        const page = await context.newPage();
        await page.goto(url);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await waitForImages(page);
        // Sin esto la captura podría ser la de la home sin aviso y pasar.
        await expect(
          page.getByRole("region", { name: LANGUAGE_NOTICE_NAME }),
        ).toBeVisible();
        const name = `aviso-idioma-${label}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
        // Si algo se sale, el mensaje dice qué: la captura no lo muestra,
        // porque se toma al ancho de la ventana.
        // Se reintenta unos segundos. En Linux, una corrida de cada tres, el
        // título de la home en inglés midió 353 px en una caja de 312 justo
        // después de una captura que sí coincidía con la línea base: la
        // página estaba bien pintada y la medida no. Un scroll horizontal
        // que se queda sigue fallando.
        await expect(async () => {
          const overflow = await page.evaluate(() => {
            const root = document.documentElement;
            const viewportWidth = root.clientWidth;
            const describe = (element: Element): string => {
              const { right, width } = element.getBoundingClientRect();
              const text = (element.textContent ?? "").trim().slice(0, 40);
              return `${element.tagName.toLowerCase()} derecha=${right.toFixed(1)} ancho=${width.toFixed(1)} propio=${String(element.scrollWidth)}/${String(element.clientWidth)} "${text}"`;
            };
            const elements = [...document.querySelectorAll("body *")];
            return {
              scrollWidth: root.scrollWidth,
              viewportWidth,
              // Lo que pasa del borde, y lo que no cabe en su propia caja.
              suspects: elements
                .filter(
                  (element) =>
                    element.getBoundingClientRect().right > viewportWidth ||
                    element.scrollWidth > element.clientWidth + 1,
                )
                .map(describe),
            };
          });
          expect(
            overflow.scrollWidth,
            `scroll horizontal a ${vp.width}px: ${overflow.suspects.join(" | ")}`,
          ).toBeLessThanOrEqual(overflow.viewportWidth);
        }).toPass({ timeout: OVERFLOW_SETTLE_MS });
        await context.close();
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Precio aproximado en dólares (FR-122)
// ---------------------------------------------------------------------------

test.describe("Precio aproximado en dólares", () => {
  for (const zone of ["dark", "light"] as const) {
    test(`en zona ${zone}, dice el aproximado, la nota y una frase para el lector de pantalla`, async ({
      page,
    }) => {
      await openComponentsPage(page);
      const approximation = page
        .locator(`[data-zone="${zone}"] p`)
        .filter({ hasText: "El cobro es en pesos colombianos." })
        .first();

      await expect(approximation).toContainText("≈ US$12");
      await expect(approximation.locator(".sr-only")).toHaveText(
        "aproximadamente 12 dólares",
      );
      await expect(approximation.locator('[aria-hidden="true"]')).toHaveText(
        "≈ US$12",
      );
    });

    test(`en zona ${zone}, axe no reporta violaciones en el aproximado`, async ({
      page,
    }) => {
      await openComponentsPage(page);
      const results = await new AxeBuilder({ page })
        .include(`[data-zone="${zone}"]`)
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Cáscara del sitio: header, enlace de salto y página 404
// ---------------------------------------------------------------------------

const SHELL_PAGES = [
  { name: "home en español", url: APP_URL },
  { name: "home en inglés", url: `${APP_URL}/en/` },
  { name: "404 en español", url: `${APP_URL}/no-existe` },
  { name: "404 en inglés", url: `${APP_URL}/en/no-existe` },
] as const;

for (const vp of viewports) {
  test.describe(`cáscara @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const shellPage of SHELL_PAGES) {
      test(`${shellPage.name}: axe no reporta violaciones`, async ({
        page,
      }) => {
        await page.goto(shellPage.url);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(
          results.violations,
          JSON.stringify(results.violations, null, 2),
        ).toEqual([]);
      });

      test(`${shellPage.name}: no hay desborde horizontal`, async ({
        page,
      }) => {
        await page.goto(shellPage.url);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow, `desborde a ${vp.width}px`).toBe(false);
      });
    }

    test("el header coincide con la línea base aprobada", async ({ page }) => {
      await page.goto(ENGLISH_HOME_URL);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const header = page.locator("header");
      const name = `header-en-${vp.name}.png`;
      await createMissingLocalBaseline(name, () =>
        header.screenshot(SCREENSHOT_OPTIONS),
      );
      await expect(header).toHaveScreenshot(name, {
        ...SCREENSHOT_OPTIONS,
        maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
      });
    });
  });
}

test.describe("cáscara: enlace de salto", () => {
  test("es el primer foco con teclado y lleva al contenido principal", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press("Enter");

    await expect(page.locator("main")).toBeFocused();
  });

  test("cada página lleva un solo main", async ({ page }) => {
    for (const { url } of SHELL_PAGES) {
      await page.goto(url);
      await expect(page.locator("main")).toHaveCount(1);
    }
  });
});

test.describe("cáscara: rutas sin ella", () => {
  test("/dev/componentes no lleva el enlace de salto ni el logo del header", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/dev/componentes`);
    await expect(
      page.getByRole("link", { name: "Saltar al contenido" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "VolleyTip, ir al inicio" }),
    ).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Pie del sitio
// ---------------------------------------------------------------------------

for (const vp of viewports) {
  test.describe(`pie @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const footerPage of [
      { language: "es", url: APP_URL },
      { language: "en", url: ENGLISH_HOME_URL },
    ]) {
      test(`${footerPage.language}: coincide con la línea base aprobada`, async ({
        page,
      }) => {
        await page.goto(footerPage.url);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        // Sin el contenido de la página: su alto puede traer fracciones de
        // píxel, y entonces el pie empieza a media fila y su captura cambia
        // cada vez que cambia la home, sin que el pie haya cambiado.
        await page.addStyleTag({ content: "main { display: none; }" });
        const footer = page.locator("footer");
        // El logo del pie carga aparte: sin esperarlo, la captura sale a medias.
        await footer
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.decode());
        const name = `pie-${footerPage.language}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          footer.screenshot(SCREENSHOT_OPTIONS),
        );
        await expect(footer).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });

      test(`${footerPage.language}: cada enlace tiene zona de toque de 44 px`, async ({
        page,
      }) => {
        await page.goto(footerPage.url);
        const sizes = await page.locator("footer a").evaluateAll((links) =>
          links.map((link) => {
            const { width, height } = link.getBoundingClientRect();
            return { name: link.textContent || link.ariaLabel, width, height };
          }),
        );
        for (const { name, width, height } of sizes) {
          expect(height, `alto de ${name}`).toBeGreaterThanOrEqual(
            MIN_TOUCH_TARGET_PX,
          );
          expect(width, `ancho de ${name}`).toBeGreaterThanOrEqual(
            MIN_TOUCH_TARGET_PX,
          );
        }
      });
    }
  });
}

test.describe("pie: salto", () => {
  test("termina cada página con el pie, que lleva el ancla", async ({
    page,
  }) => {
    for (const { url } of SHELL_PAGES) {
      await page.goto(url);
      await expect(page.locator("footer#pie")).toHaveCount(1);
    }
  });

  test("en una página corta el pie queda pegado al fondo de la pantalla", async ({
    page,
  }) => {
    const TALL_VIEWPORT = { width: 1440, height: 1600 };
    await page.setViewportSize(TALL_VIEWPORT);
    await page.goto(`${APP_URL}/no-existe`);

    const footerBottom = await page
      .locator("footer#pie")
      .evaluate((footer) => footer.getBoundingClientRect().bottom);

    expect(Math.round(footerBottom)).toBe(TALL_VIEWPORT.height);
  });

  test("dentro de la columna el header conserva su ancho completo", async ({
    page,
  }) => {
    const HEADER_MAX_WIDTH = 1280;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(APP_URL);

    const headerWidth = await page
      .locator("header")
      .evaluate((header) => header.getBoundingClientRect().width);

    expect(Math.round(headerWidth)).toBe(HEADER_MAX_WIDTH);
  });
});
// Barra de anuncios (#85). Playwright corre contra la base local, y antes de
// cada corrida deja en ella estos mensajes (tests/support/site-fixtures.ts).
// Si la barra no sale, la prueba falla: una página sin barra no es un caso
// que se pueda saltar.
const [FIRST_ANNOUNCEMENT, ...OTHER_ANNOUNCEMENTS] = ANNOUNCEMENT_FIXTURES;
const PHONE_MAX_WIDTH = 768;

for (const vp of viewports) {
  test.describe(`barra de anuncios @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const [language, url] of [
      ["es", APP_URL],
      ["en", `${APP_URL}/en/`],
    ] as const) {
      test(`${language}: muestra un mensaje en celular y los tres desde 768 px`, async ({
        page,
      }) => {
        await page.goto(url);
        await expect(
          page.getByText(FIRST_ANNOUNCEMENT[language], { exact: true }),
        ).toBeVisible();
        for (const message of OTHER_ANNOUNCEMENTS) {
          const item = page.getByText(message[language], { exact: true });
          // Está en la página aunque no se vea: en celular se oculta, no se
          // quita.
          await expect(item).toHaveCount(1);
          await (vp.width < PHONE_MAX_WIDTH
            ? expect(item).toBeHidden()
            : expect(item).toBeVisible());
        }
      });
    }

    test("va arriba del header", async ({ page }) => {
      await page.goto(APP_URL);
      const barBottom = await page
        .getByText(FIRST_ANNOUNCEMENT.es, { exact: true })
        .evaluate((item) => item.getBoundingClientRect().bottom);
      const headerTop = await page
        .locator("header")
        .evaluate((header) => header.getBoundingClientRect().top);

      expect(barBottom).toBeLessThanOrEqual(headerTop);
    });

    test("mide un número entero de píxeles de alto", async ({ page }) => {
      // Con medio píxel de alto, todo lo que va debajo se pinta corrido y
      // borroso, empezando por el header.
      await page.goto(APP_URL);
      const barHeight = await page
        .getByText(FIRST_ANNOUNCEMENT.es, { exact: true })
        .evaluate(
          (item) => item.closest("div")?.getBoundingClientRect().height ?? 0,
        );

      expect(barHeight).toBeGreaterThan(0);
      expect(Number.isInteger(barHeight)).toBe(true);
    });

    test("la 404 también la lleva", async ({ page }) => {
      await page.goto(`${APP_URL}/no-existe`);

      await expect(
        page.getByText(FIRST_ANNOUNCEMENT.es, { exact: true }),
      ).toBeVisible();
    });
  });
}

// ---------------------------------------------------------------------------
// Páginas de error: 404 (con la cáscara) y 500 (sin ella), en los dos idiomas.
// ---------------------------------------------------------------------------

const ERROR_PAGES = [
  { name: "404-es", path: "/esta-pagina-no-existe", status: 404 },
  { name: "404-en", path: "/en/esta-pagina-no-existe", status: 404 },
  { name: "500-es", path: "/dev/fallo", status: 500 },
  { name: "500-en", path: "/en/dev/fallo", status: 500 },
] as const;

for (const errorPage of ERROR_PAGES) {
  for (const vp of viewports) {
    test.describe(`error ${errorPage.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("coincide con la línea base aprobada", async ({ page }) => {
        const response = await page.goto(`${APP_URL}${errorPage.path}`);
        expect(response?.status()).toBe(errorPage.status);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const name = `error-${errorPage.name}-${vp.name}.png`;
        // El código de referencia de la 500 cambia en cada petición.
        const referenceCode = [page.locator("p:has(strong)")];
        await createMissingLocalBaseline(name, () =>
          page.screenshot({
            ...SCREENSHOT_OPTIONS,
            fullPage: true,
            mask: referenceCode,
          }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          mask: referenceCode,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });

      test("axe no reporta violaciones y no hay scroll horizontal", async ({
        page,
      }) => {
        await page.goto(`${APP_URL}${errorPage.path}`);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(results.violations).toEqual([]);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    });
  }
}

test.describe("página 500", () => {
  test("no muestra el mensaje del error y ofrece reintentar e ir a la home", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/dev/fallo`);
    await expect(page.locator("h1")).toHaveText(/Pedimos tiempo/i);
    await expect(page.getByText("detalle-tecnico-secreto")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Reintentar" }),
    ).toHaveAttribute("href", "/dev/fallo");
    await expect(
      page.getByRole("link", { name: "Ir al inicio", exact: true }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("un 403 conserva su estado", async ({ page }) => {
    const response = await page.goto(`${APP_URL}/dev/fallo?estado=403`);
    expect(response?.status()).toBe(403);
    await expect(page.locator("h1")).not.toHaveText(/Pedimos tiempo/i);
  });
});

test.describe("página 500 al navegar sin recargar", () => {
  test("un loader que falla también muestra el código de referencia", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.waitForFunction(() => "__reactRouterDataRouter" in window);

    await page.evaluate(() => {
      const router = (
        window as unknown as {
          __reactRouterDataRouter: { navigate: (to: string) => Promise<void> };
        }
      ).__reactRouterDataRouter;
      void router.navigate("/dev/fallo");
    });

    await expect(page.locator("h1")).toHaveText(/Pedimos tiempo/i);
    await expect(page).toHaveURL(`${APP_URL}/dev/fallo`);
    await expect(page.locator("p:has(strong) strong")).toHaveText(
      /^[0-9A-F]{8}$/,
    );
  });
});

// Página del modo mantenimiento (/dev/mantenimiento): se pinta sin encender
// el modo en la base de pruebas. La hora fija es futura sin importar cuándo
// corra la prueba: la ruta de muestra no consulta el reloj.
const MAINTENANCE_RETURN_TIME = "2099-12-01T20:30:00Z";
const MAINTENANCE_VARIANTS = [
  {
    name: "es-con-hora",
    path: `/dev/mantenimiento?hora=${MAINTENANCE_RETURN_TIME}`,
  },
  { name: "es-sin-hora", path: "/dev/mantenimiento" },
  {
    name: "en-con-hora",
    path: `/en/dev/mantenimiento?hora=${MAINTENANCE_RETURN_TIME}`,
  },
  { name: "en-sin-hora", path: "/en/dev/mantenimiento" },
] as const;

for (const variant of MAINTENANCE_VARIANTS) {
  for (const vp of viewports) {
    test.describe(`mantenimiento ${variant.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("coincide con la línea base aprobada", async ({ page }) => {
        await page.goto(`${APP_URL}${variant.path}`);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const name = `maintenance-${variant.name}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });

      test("axe no reporta violaciones", async ({ page }) => {
        await page.goto(`${APP_URL}${variant.path}`);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Home: invitación "Avísame" (AC-023)
// ---------------------------------------------------------------------------

const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
// El servidor rechaza lo enviado en menos de 3 segundos desde que se pintó.
const MIN_HUMAN_DELAY_MS = 3200;
const CAMP_NOTIFY_LANGUAGES = [
  { name: "español", url: APP_URL, heading: "Avísame del próximo camp" },
  {
    name: "inglés",
    url: ENGLISH_HOME_URL,
    heading: "Tell me about the next camp",
  },
] as const;

/** El widget real no corre en las pruebas: se le pone el token de prueba. */
async function openCampNotify(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.evaluate((token) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cf-turnstile-response";
    input.value = token;
    document
      .querySelector<HTMLFormElement>(
        "section[aria-labelledby='camp-notify-title'] form",
      )
      ?.append(input);
  }, TURNSTILE_DUMMY_TOKEN);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(MIN_HUMAN_DELAY_MS);
}

for (const language of CAMP_NOTIFY_LANGUAGES) {
  for (const vp of viewports) {
    test.describe(`avísame ${language.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("el formulario vacío coincide con la línea base y no desborda", async ({
        page,
      }) => {
        await openCampNotify(page, language.url);
        const section = page.locator(
          "section[aria-labelledby='camp-notify-title']",
        );
        await expect(
          section.getByRole("heading", { name: language.heading }),
        ).toBeVisible();
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow, `desborde horizontal a ${vp.width}px`).toBe(false);
        const name = `avisame-${language.name === "español" ? "es" : "en"}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          section.screenshot(SCREENSHOT_OPTIONS),
        );
        await expect(section).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });
    });
  }

  test.describe(`avísame ${language.name}`, () => {
    test("axe no reporta violaciones con el formulario", async ({ page }) => {
      await openCampNotify(page, language.url);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([]);
    });

    test("un correo inválido muestra el error junto al campo y conserva lo escrito", async ({
      page,
    }) => {
      await openCampNotify(page, language.url);
      const section = page.locator(
        "section[aria-labelledby='camp-notify-title']",
      );
      await section.locator("input[name='email']").fill("no-es-correo");
      await section.locator("input[name='city']").fill("Cali");
      await section.getByRole("button").click();

      const email = section.locator("input[name='email']");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(email).toHaveValue("no-es-correo");
      await expect(section.locator("input[name='city']")).toHaveValue("Cali");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([]);
    });

    test("se envía con el teclado y la confirmación reemplaza al formulario", async ({
      page,
    }) => {
      await openCampNotify(page, language.url);
      const section = page.locator(
        "section[aria-labelledby='camp-notify-title']",
      );
      await section.locator("input[name='email']").focus();
      await page.keyboard.type(`e2e-${Date.now()}@example.com`);
      await page.keyboard.press("Enter");

      const confirmation = section
        .getByRole("status")
        .filter({ hasText: /\w/ });
      await expect(confirmation).toBeVisible();
      await expect(section.locator("form")).toHaveCount(0);
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

test.describe("avísame sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("el formulario envía y la confirmación se ve", async ({ page }) => {
    await page.goto(APP_URL);
    const section = page.locator(
      "section[aria-labelledby='camp-notify-title']",
    );
    // Sin JavaScript no hay widget: se pone el token de prueba al armar la petición.
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fallback({
        postData: `${request.postData() ?? ""}&cf-turnstile-response=${TURNSTILE_DUMMY_TOKEN}`,
      });
    });
    await page.waitForTimeout(MIN_HUMAN_DELAY_MS);
    await section
      .locator("input[name='email']")
      .fill(`e2e-${Date.now()}@example.com`);
    await section.getByRole("button").click();

    await expect(section.locator("div[role='status']")).toContainText(
      "te avisaremos",
    );
  });
});

// ---------------------------------------------------------------------------
// Página de la app (#95). Los estados se ven en /dev/app, que no toca la
// base; axe, el desborde y el envío los cubre tests/app-page.spec.ts.
// ---------------------------------------------------------------------------

const APP_PAGE_VARIANTS = [
  { name: "es-espera", path: "/dev/app" },
  { name: "es-confirmacion", path: "/dev/app?resultado=unido" },
  { name: "es-disponible", path: "/dev/app?estado=disponible" },
  { name: "en-espera", path: "/en/dev/app" },
  { name: "en-confirmacion", path: "/en/dev/app?resultado=unido" },
  { name: "en-disponible", path: "/en/dev/app?estado=disponible" },
] as const;

for (const variant of APP_PAGE_VARIANTS) {
  for (const vp of viewports) {
    test.describe(`app ${variant.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("coincide con la línea base aprobada", async ({ page }) => {
        await page.goto(`${APP_URL}${variant.path}`);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await waitForImages(page);
        const name = `app-${variant.name}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Página Nosotros (#96). Axe y desborde en tests/about-page.spec.ts.
// ---------------------------------------------------------------------------

const ABOUT_PAGE_VARIANTS = [
  { name: "es", path: "/nosotros" },
  { name: "en", path: "/en/about" },
] as const;

for (const variant of ABOUT_PAGE_VARIANTS) {
  for (const vp of viewports) {
    test.describe(`nosotros ${variant.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("coincide con la línea base aprobada", async ({ page }) => {
        await page.goto(`${APP_URL}${variant.path}`);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await waitForImages(page);
        const name = `nosotros-${variant.name}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Preguntas frecuentes (#93). Con preguntas y vacía se ven en /dev/faq, que
// no toca la base; axe, el desborde y el teclado los cubre
// tests/faq-page.spec.ts.
// ---------------------------------------------------------------------------

const FAQ_PAGE_VARIANTS = [
  { name: "es-preguntas", path: "/dev/faq", opensFirst: false },
  { name: "es-abierta", path: "/dev/faq", opensFirst: true },
  { name: "es-vacia", path: "/dev/faq?estado=vacia", opensFirst: false },
  { name: "en-preguntas", path: "/en/dev/faq", opensFirst: false },
  { name: "en-abierta", path: "/en/dev/faq", opensFirst: true },
  { name: "en-vacia", path: "/en/dev/faq?estado=vacia", opensFirst: false },
] as const;

for (const variant of FAQ_PAGE_VARIANTS) {
  for (const vp of viewports) {
    test.describe(`preguntas frecuentes ${variant.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("coincide con la línea base aprobada", async ({ page }) => {
        await page.goto(`${APP_URL}${variant.path}`);
        if (variant.opensFirst) {
          const firstQuestion = page.locator("details").first();
          // Un clic que llega mientras la página termina de cargar puede no
          // dejarla abierta, y la captura saldría con la pregunta cerrada.
          await expect(async () => {
            if (
              !(await firstQuestion.evaluate((el) => "open" in el && el.open))
            ) {
              await firstQuestion.locator("summary").click();
            }
            await expect(firstQuestion).toHaveAttribute("open", "");
          }).toPass();
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await waitForImages(page);
        const name = `preguntas-frecuentes-${variant.name}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Contacto (#94). Los estados se ven en /dev/contact, que no toca la base;
// axe, el desborde y el teclado los cubre tests/contact-page.spec.ts.
// ---------------------------------------------------------------------------

const CONTACT_PAGE_VARIANTS = [
  { name: "pedido", query: "?motivo=pedido" },
  { name: "marcas", query: "?motivo=marcas" },
  { name: "otro", query: "?motivo=otro" },
  { name: "errores", query: "?motivo=pedido&resultado=invalido" },
  { name: "confirmacion", query: "?resultado=enviado" },
] as const;
const CONTACT_PAGE_LANGUAGES = [
  { name: "es", prefix: "" },
  { name: "en", prefix: "/en" },
] as const;

for (const language of CONTACT_PAGE_LANGUAGES) {
  for (const variant of CONTACT_PAGE_VARIANTS) {
    for (const vp of viewports) {
      test.describe(`contacto ${language.name} ${variant.name} @ ${vp.name}`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        test("coincide con la línea base aprobada", async ({ page }) => {
          await page.goto(
            `${APP_URL}${language.prefix}/dev/contact${variant.query}`,
          );
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          await waitForImages(page);
          const name = `contacto-${language.name}-${variant.name}-${vp.name}.png`;
          await createMissingLocalBaseline(name, () =>
            page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
          );
          await expect(page).toHaveScreenshot(name, {
            ...SCREENSHOT_OPTIONS,
            fullPage: true,
            maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
          });
        });
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Enlace de una rutina, /r/<código> (#97). Axe y desborde en
// tests/routine-link.spec.ts.
// ---------------------------------------------------------------------------

const ROUTINE_LINK_VARIANTS = [
  { name: "es", path: "/r/abc123" },
  { name: "en", path: "/en/r/abc123" },
] as const;

for (const variant of ROUTINE_LINK_VARIANTS) {
  for (const vp of viewports) {
    test.describe(`rutina ${variant.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("coincide con la línea base aprobada", async ({ page }) => {
        await page.goto(`${APP_URL}${variant.path}`);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await waitForImages(page);
        const name = `rutina-${variant.name}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// El panel: su entrada (#120), la pantalla del staff (#119) y la cáscara
// (#122). Axe, desborde y comportamiento en tests/admin-sign-in.spec.ts,
// tests/admin-panel.spec.ts y tests/admin-shell.spec.ts.
// ---------------------------------------------------------------------------

const PANEL_PROVISIONAL_VIEWPORTS = viewports.filter(({ name }) =>
  ["mobile", "desktop"].includes(name),
);

// La cáscara y el resumen (#124) de la muestra, en los dos idiomas. La muestra
// no usa la base: el panel real pinta lo que haya en ella y cambiaría en cada
// corrida.
const PANEL_SHELL_VARIANTS = [
  // "Textos del sitio" (#126) en cada estado, en los dos idiomas.
  ...["datos", "errores", "confirmacion", "invalido"].flatMap((state) => [
    {
      name: `textos-${state}`,
      path: `/dev/panel/textos?textos=${state}`,
      role: undefined,
    },
    {
      name: `textos-${state}-en`,
      path: `/en/dev/panel/site-texts?textos=${state}`,
      role: undefined,
    },
  ]),
  {
    name: "resumen-datos",
    path: "/dev/panel?resumen=datos",
    role: undefined,
  },
  {
    name: "resumen-datos-en",
    path: "/en/dev/panel?resumen=datos",
    role: undefined,
  },
  {
    name: "resumen-vacio",
    path: "/dev/panel?resumen=vacio",
    role: undefined,
  },
  {
    name: "resumen-vacio-en",
    path: "/en/dev/panel?resumen=vacio",
    role: undefined,
  },
  { name: "muestra", path: "/dev/panel", role: undefined },
  { name: "muestra-en", path: "/en/dev/panel", role: undefined },
  { name: "mas", path: "/dev/panel/mas", role: undefined },
  { name: "mas-en", path: "/en/dev/panel/more", role: undefined },
  {
    name: "mantenimiento",
    path: "/dev/panel?mantenimiento=1",
    role: undefined,
  },
  {
    name: "mantenimiento-en",
    path: "/en/dev/panel?mantenimiento=1",
    role: undefined,
  },
] as const;

interface PanelVariant {
  readonly name: string;
  readonly path: string;
  readonly role: "admin" | "staff" | undefined;
  readonly sizes: readonly (typeof viewports)[number][];
}

// La entrada y la página de su enlace (#120), cada estado en los dos idiomas.
// La muestra no usa la base ni manda correos.
const SIGN_IN_STATES = [
  "vacio",
  "error",
  "enviado",
  "enlace",
  "vencido",
] as const;

const SIGN_IN_VARIANTS: readonly PanelVariant[] = SIGN_IN_STATES.flatMap(
  (state) =>
    [
      { suffix: "", path: "/dev/entrar" },
      { suffix: "-en", path: "/en/dev/entrar" },
    ].map(({ suffix, path }) => ({
      name: `entrada-${state}${suffix}`,
      path: `${path}?estado=${state}`,
      role: undefined,
      sizes: viewports,
    })),
);

// Los ajustes y la confirmación del mantenimiento (#129), cada estado en los
// dos idiomas. La muestra no usa la base.
const SETTINGS_STATES = [
  "apagado",
  "encendido",
  "invalido",
  "errores",
  "confirmar",
] as const;

const SETTINGS_VARIANTS: readonly PanelVariant[] = SETTINGS_STATES.flatMap(
  (state) =>
    [
      { suffix: "", path: "/dev/ajustes" },
      { suffix: "-en", path: "/en/dev/ajustes" },
    ].map(({ suffix, path }) => ({
      name: `ajustes-${state}${suffix}`,
      path: `${path}?estado=${state}`,
      role: undefined,
      sizes: viewports,
    })),
);

// La bitácora (#131): la lista con entradas, vacía y el detalle, en los dos
// idiomas. La muestra no usa la base.
const AUDIT_LOG_VARIANTS: readonly PanelVariant[] = [
  "datos",
  "vacio",
  "detalle",
].flatMap((state) =>
  [
    { suffix: "", path: "/dev/panel/bitacora" },
    { suffix: "-en", path: "/en/dev/panel/audit-log" },
  ].map(({ suffix, path }) => ({
    name: `bitacora-${state}${suffix}`,
    path: `${path}?bitacora=${state}`,
    role: undefined,
    sizes: viewports,
  })),
);

const PANEL_VARIANTS: readonly PanelVariant[] = [
  ...SIGN_IN_VARIANTS,
  ...SETTINGS_VARIANTS,
  ...AUDIT_LOG_VARIANTS,
  {
    name: "staff",
    path: "/admin",
    role: "staff",
    sizes: PANEL_PROVISIONAL_VIEWPORTS,
  },
  ...PANEL_SHELL_VARIANTS.map((variant) => ({
    ...variant,
    sizes: viewports,
  })),
];

for (const variant of PANEL_VARIANTS) {
  for (const vp of variant.sizes) {
    test.describe(`panel ${variant.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("coincide con la línea base aprobada", async ({
        page,
        signInToPanel,
      }) => {
        if (variant.role !== undefined) {
          // El nombre se ve en la captura: siempre el mismo.
          await signInToPanel({ role: variant.role, fullName: "Andrés Gómez" });
        }
        await page.goto(`${APP_URL}${variant.path}`);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await waitForImages(page);
        const name = `panel-${variant.name}-${vp.name}.png`;
        await createMissingLocalBaseline(name, () =>
          page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true }),
        );
        await expect(page).toHaveScreenshot(name, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
        });
      });
    });
  }
}
