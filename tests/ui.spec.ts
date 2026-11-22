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
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/**";
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

interface TurnstileCall {
  readonly method: string;
  readonly sitekey?: string;
}

/**
 * Reemplaza el script de Cloudflare por uno propio que anota cómo lo llama
 * la página. Así ninguna prueba depende de la red, y la captura no cambia
 * con lo que Cloudflare decida dibujar ese día.
 */
async function stubTurnstile(page: Page): Promise<void> {
  await page.route(TURNSTILE_SCRIPT, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
        window.turnstileCalls = [];
        window.turnstile = {
          render(container, options) {
            window.turnstileCalls.push({ method: "render", sitekey: options.sitekey });
            return "widget-de-prueba";
          },
          reset() { window.turnstileCalls.push({ method: "reset" }); },
          remove() { window.turnstileCalls.push({ method: "remove" }); },
        };
      `,
    }),
  );
}

async function readTurnstileCalls(page: Page): Promise<TurnstileCall[]> {
  return page.evaluate(
    () =>
      (window as unknown as { turnstileCalls?: TurnstileCall[] })
        .turnstileCalls ?? [],
  );
}

async function openComponentsPage(page: Page): Promise<void> {
  await stubTurnstile(page);
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
      .toEqual([{ method: "render", sitekey: TURNSTILE_TEST_SITE_KEY }]);
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
        const page = await context.newPage();
        await page.goto(url);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
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
});
