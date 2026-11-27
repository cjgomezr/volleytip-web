/**
 * Los fallos del panel (#143) en el navegador. La pantalla de fallo se mira en
 * la muestra (/dev/panel/textos?fallo=...), que no usa la base. Los envíos que
 * no llegan y el fallo del servidor se prueban en el panel real, sin escribir
 * nada. Las capturas viven en `ui.spec.ts`.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./support/panel-session";

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

/** Holgura para lo que todavía crezca después de medir la página. */
const SPARE_HEIGHT = 200;

const LANGUAGES = [
  {
    code: "es",
    sample: "/dev/panel/textos",
    panel: "/admin/textos",
    settings: "/admin/ajustes",
    confirmation: "/admin/ajustes/mantenimiento",
    firstField: "Texto en español",
    value: "Valor en español",
    saveBar: "Guardar barra",
    saveFigures: "Guardar cifras",
    auditLog: "/admin/bitacora",
    filter: "Filtrar",
    signIn: "/admin/entrar",
    sendLink: "Enviarme el enlace",
    auditLogLink: "Bitácora",
    saveApp: "Guardar estado de la app",
    confirm: "Sí, encender",
    otherLanguage: "English",
    signOut: "Cerrar sesión",
    unsent: "No se pudo enviar",
    claim: "registrado",
    back: "Volver a la pantalla",
    titles: { servidor: "Algo falló", red: "No hay conexión" },
  },
  {
    code: "en",
    sample: "/en/dev/panel/site-texts",
    panel: "/en/admin/site-texts",
    settings: "/en/admin/settings",
    confirmation: "/en/admin/settings/maintenance",
    firstField: "Spanish text",
    value: "Spanish value",
    saveBar: "Save bar",
    saveFigures: "Save figures",
    auditLog: "/en/admin/audit-log",
    filter: "Apply filters",
    signIn: "/en/admin/sign-in",
    sendLink: "Send me the link",
    auditLogLink: "Audit log",
    saveApp: "Save app status",
    confirm: "Yes, turn it on",
    otherLanguage: "Español",
    signOut: "Sign out",
    unsent: "It could not be sent",
    claim: "logged",
    back: "Back to the screen",
    titles: { servidor: "Something went wrong", red: "No connection" },
  },
] as const;

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  // Con la ventana tan alta como la página, la barra inferior no tapa nada
  // que axe tenga que medir.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const height = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.documentElement.scrollHeight;
  });
  const width = page.viewportSize()?.width ?? 0;
  await page.setViewportSize({ width, height: height + SPARE_HEIGHT });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

/** Corta los envíos: las lecturas siguen llegando. */
async function cutSubmissions(page: Page): Promise<void> {
  await page.route("**/*", (route) =>
    route.request().method() === "POST"
      ? route.abort("internetdisconnected")
      : route.fallback(),
  );
}

async function openPanel(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Navega sin recargar, como un enlace que agrega una entrada al historial.
 * Usa el router que React Router deja en `window`. */
async function pushSameScreen(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const { __reactRouterDataRouter: router } = window as unknown as {
      __reactRouterDataRouter: { navigate(to: string): Promise<void> };
    };
    await router.navigate(to);
  }, path);
  await expect(page).toHaveURL(path);
}

/** Espera a que React Router termine de navegar a la búsqueda `search`. */
async function waitForRouter(page: Page, search: string): Promise<void> {
  await page.waitForFunction((expected) => {
    const { __reactRouterDataRouter: router } = window as unknown as {
      __reactRouterDataRouter: {
        state: {
          location: { search: string };
          navigation: { state: string };
        };
      };
    };
    const { location, navigation } = router.state;
    return location.search === expected && navigation.state === "idle";
  }, search);
}

for (const language of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`fallo del panel (${language.code}) @ ${viewport.width}`, () => {
      test.use({ viewport });

      for (const failure of ["servidor", "red"] as const) {
        test(`la pantalla de fallo (${failure}) va dentro del panel, pasa axe y no desborda`, async ({
          page,
        }) => {
          await page.goto(`${language.sample}?fallo=${failure}`);

          await expect(
            page.getByRole("heading", { name: language.titles[failure] }),
          ).toBeVisible();
          await expect(page.getByRole("alert")).toBeVisible();
          await expect(
            page.getByRole("link", { name: language.back }),
          ).toBeVisible();
          await expect(page.locator("[data-panel-shell]")).toBeVisible();
          await expectAccessibleWithoutOverflow(page);
        });
      }

      test("sin red, Textos del sitio conserva lo escrito y avisa", async ({
        page,
        signInToPanel,
      }) => {
        await signInToPanel({ role: "admin" });
        await openPanel(page, language.panel);
        const field = page.getByLabel(language.firstField).first();
        await field.fill("Sin guardar todavía");
        await cutSubmissions(page);

        await page.getByRole("button", { name: language.saveBar }).click();

        const alert = page.getByRole("alert");
        await expect(alert).toContainText(language.unsent);
        await expect(alert).not.toContainText(language.claim);
        await expect(field).toHaveValue("Sin guardar todavía");
        await expect(page).toHaveURL(language.panel);
        await expectAccessibleWithoutOverflow(page);
      });
    });
  }

  test.describe(`envíos que no llegan (${language.code})`, () => {
    test.use({ viewport: VIEWPORTS[3] });

    // Sin red del todo, y no solo con el envío cortado: lo que la pantalla
    // necesite para responder ya tiene que estar en el navegador.
    test("sin conexión, las cifras conservan lo escrito", async ({
      page,
      context,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await openPanel(page, language.panel);
      const field = page.getByLabel(language.value).first();
      await field.fill("999K");
      await context.setOffline(true);

      await page.getByRole("button", { name: language.saveFigures }).click();

      await expect(page.getByRole("alert")).toContainText(language.unsent);
      await expect(field).toHaveValue("999K");
      await expect(page).toHaveURL(language.panel);
    });

    test("sin conexión, Ajustes conserva lo escrito", async ({
      page,
      context,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await openPanel(page, language.settings);
      const field = page.locator('input[name="appStoreUrl"]');
      await field.fill("https://apps.apple.com/app/id1");
      await context.setOffline(true);

      await page.getByRole("button", { name: language.saveApp }).click();

      await expect(page.getByRole("alert")).toContainText(language.unsent);
      await expect(field).toHaveValue("https://apps.apple.com/app/id1");
      await expect(page).toHaveURL(language.settings);
    });

    for (const [name, path, button] of [
      ["la confirmación del mantenimiento", "confirmation", "confirm"],
      ["el idioma del panel", "panel", "otherLanguage"],
      ["cerrar sesión", "panel", "signOut"],
    ] as const) {
      test(`sin conexión, ${name} deja a la persona donde estaba`, async ({
        page,
        context,
        signInToPanel,
      }) => {
        await signInToPanel({ role: "admin" });
        await openPanel(page, language[path]);
        await context.setOffline(true);

        await page.getByRole("button", { name: language[button] }).click();

        await expect(page.getByRole("alert")).toContainText(language.unsent);
        await expect(page).toHaveURL(language[path]);
        await expect(page.locator("[data-panel-shell]")).toBeVisible();
      });
    }

    test("sin conexión, filtrar la bitácora deja los filtros puestos", async ({
      page,
      context,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await openPanel(page, language.auditLog);
      const from = page.locator('input[type="date"]').first();
      await from.fill("2026-11-01");
      await context.setOffline(true);

      await page.getByRole("button", { name: language.filter }).click();

      await expect(page.getByRole("alert")).toContainText(language.unsent);
      await expect(from).toHaveValue("2026-11-01");
      await expect(page).toHaveURL(language.auditLog);
    });

    test("sin conexión, la entrada conserva el correo escrito", async ({
      page,
      context,
    }) => {
      await openPanel(page, language.signIn);
      const email = page.locator('input[name="email"]');
      await email.fill("persona@prueba.volleytip.test");
      await context.setOffline(true);

      await page.getByRole("button", { name: language.sendLink }).click();

      await expect(page.getByRole("alert")).toContainText(language.unsent);
      await expect(email).toHaveValue("persona@prueba.volleytip.test");
    });

    // Con la red "puesta" pero sin llegar a nadie.
    test("si el envío de la entrada se corta, conserva el correo y avisa", async ({
      page,
    }) => {
      await openPanel(page, language.signIn);
      const email = page.locator('input[name="email"]');
      await email.fill("persona@prueba.volleytip.test");
      await cutSubmissions(page);

      await page.getByRole("button", { name: language.sendLink }).click();

      const alert = page.getByRole("alert");
      await expect(alert).toContainText(language.unsent);
      await expect(alert).not.toContainText(language.claim);
      await expect(email).toHaveValue("persona@prueba.volleytip.test");
    });

    test("el aviso de los filtros se quita al navegar", async ({
      page,
      context,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await openPanel(page, language.auditLog);
      await context.setOffline(true);
      await page.getByRole("button", { name: language.filter }).click();
      await expect(page.getByRole("alert")).toContainText(language.unsent);
      await context.setOffline(false);

      await page
        .getByRole("complementary")
        .getByRole("link", { name: language.auditLogLink })
        .click();

      await expect(page.getByRole("alert")).toHaveCount(0);
    });

    // El aviso es del envío que falló: no se queda cuando el siguiente
    // funciona ni cuando la persona navega.
    test("al volver la red, el siguiente envío quita el aviso", async ({
      page,
      context,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await openPanel(page, language.panel);
      const change = page
        .getByRole("complementary")
        .getByRole("button", { name: language.otherLanguage });
      await context.setOffline(true);
      await change.click();
      await expect(page.getByRole("alert")).toContainText(language.unsent);
      await context.setOffline(false);

      await change.click();

      await expect(page).not.toHaveURL(language.panel);
      await expect(page.getByRole("alert")).toHaveCount(0);
    });

    test("navegar quita el rechazo del último envío, también al volver atrás", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await openPanel(page, language.settings);
      const field = page.locator('input[name="appStoreUrl"]');
      const saved = await field.inputValue();
      await field.fill("esto no es una dirección");
      await page.getByRole("button", { name: language.saveApp }).click();
      await expect(page.getByRole("alert")).toBeVisible();

      // Una entrada nueva del historial en la misma pantalla. Un enlace a la
      // dirección actual la reemplazaría y "atrás" no tendría a dónde volver.
      await pushSameScreen(page, `${language.settings}?otra=1`);

      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(field).toHaveValue(saved);

      await page.goBack();

      // La dirección cambia antes de que la pantalla se vuelva a pintar.
      await waitForRouter(page, "");
      await expect(page).toHaveURL(language.settings);
      await expect(
        page.getByRole("button", { name: language.saveApp }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    });

    // Un cuerpo que el servidor no sabe leer hace fallar su `action`: un 500
    // de verdad, sin tocar la base.
    test("un fallo del servidor se pinta dentro del panel y dice que quedó registrado", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await openPanel(page, language.panel);
      await page.route("**/*", (route) => {
        const request = route.request();
        return request.method() === "POST"
          ? route.continue({
              headers: { ...request.headers(), "content-type": "text/plain" },
            })
          : route.fallback();
      });
      const response = page.waitForResponse(
        (candidate) => candidate.request().method() === "POST",
      );

      await page.getByRole("button", { name: language.saveBar }).click();

      expect((await response).status()).toBe(500);
      await expect(
        page.getByRole("heading", { name: language.titles.servidor }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toContainText(language.claim);
      await expect(page.locator("[data-panel-shell]")).toBeVisible();
      await page.getByRole("link", { name: language.back }).click();
      await expect(page).toHaveURL(language.panel);
      await expect(
        page.getByRole("button", { name: language.saveBar }),
      ).toBeVisible();
    });
  });
}
