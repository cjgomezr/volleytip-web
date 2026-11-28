/**
 * La espera que comparten las pruebas (#144). Fuerza los dos momentos que las
 * hacían fallar a ratos: la hidratación que todavía no llegó, y un clic antes
 * de hidratar que carga otra página con su hoja de estilos aún en camino.
 */
import { expect, test } from "./support/panel-session";
import { waitForSettledPage } from "./support/page-ready";

/** Lo que mide como mínimo una zona de toque (WCAG 2.2, `target-size`). */
const MIN_TARGET_SIZE = 24;
const SLOW_HYDRATION_MS = 2_000;
const SLOW_STYLESHEET_MS = 2_000;
const SLOW_FONT_MS = 500;
/** El módulo que hidrata. Se pide aparte, así que no atrasa `load`. */
const HYDRATION_MODULE = /entry\.client/;
/** El atributo que la espera vigila. Lo pone React Router en desarrollo. */
const DEV_CRITICAL_CSS_ATTRIBUTE = "data-react-router-critical-css";

test.use({ viewport: { width: 1440, height: 900 } });

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("no vuelve hasta que la página hidrató y recargó sus fuentes", async ({
  page,
}) => {
  await page.route(HYDRATION_MODULE, async (route) => {
    await delay(SLOW_HYDRATION_MS);
    await route.continue();
  });
  // Con las fuentes lentas, la recarga que sigue al cambio de hojas dura lo
  // suficiente para verla.
  await page.route("**/*.woff2*", async (route) => {
    await delay(SLOW_FONT_MS);
    await route.continue();
  });
  await page.goto("/");

  await waitForSettledPage(page);

  // Una sola lectura, sin reintentos: lo que importa es cómo está al volver.
  const state = await page.evaluate((attribute) => {
    document.body.getBoundingClientRect();
    return {
      temporaryStylesheets: document.querySelectorAll(`[${attribute}]`).length,
      fonts: document.fonts.status,
    };
  }, DEV_CRITICAL_CSS_ATTRIBUTE);
  expect(state).toEqual({ temporaryStylesheets: 0, fonts: "loaded" });
});

test("espera la hoja de estilos de la página a la que llevó un clic sin hidratar", async ({
  page,
  signInToPanel,
}) => {
  await signInToPanel({ role: "admin" });
  await page.route(HYDRATION_MODULE, async (route) => {
    await delay(SLOW_HYDRATION_MS);
    await route.continue();
  });
  let hasHeldStylesheet = false;
  await page.route(
    /critical\.css\?pathname=\/admin\/ajustes/,
    async (route) => {
      hasHeldStylesheet = true;
      await delay(SLOW_STYLESHEET_MS);
      await route.continue();
    },
  );
  await page.goto("/admin");
  const menuLink = page
    .getByRole("complementary")
    .getByRole("link", { name: "Ajustes" });
  await menuLink.click();
  await expect(page).toHaveURL("/admin/ajustes");
  await expect(menuLink).toBeVisible();

  await waitForSettledPage(page);

  // El clic llegó antes de hidratar: solo así se pide esa hoja.
  expect(hasHeldStylesheet).toBe(true);
  const box = await menuLink.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(MIN_TARGET_SIZE);
});

// Si una versión nueva de React Router le cambia el nombre, la espera dejaría
// de esperar la hidratación sin que nada falle.
test("el servidor de desarrollo marca su hoja de estilos provisional", async ({
  request,
}) => {
  const response = await request.get("/");

  expect(await response.text()).toContain(DEV_CRITICAL_CSS_ATTRIBUTE);
});
