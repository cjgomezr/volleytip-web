/**
 * La espera que comparten las pruebas (#144). Fuerza el momento que las hacía
 * fallar a ratos: un clic antes de hidratar, que carga otra página, con la
 * hoja de estilos de esa página todavía en camino.
 */
import { expect, test } from "./support/panel-session";
import { waitForSettledPage } from "./support/page-ready";

/** Lo que mide como mínimo una zona de toque (WCAG 2.2, `target-size`). */
const MIN_TARGET_SIZE = 24;
const SLOW_HYDRATION_MS = 2_000;
const SLOW_STYLESHEET_MS = 2_000;
/** El atributo que la espera vigila. Lo pone React Router en desarrollo. */
const DEV_CRITICAL_CSS_ATTRIBUTE = "data-react-router-critical-css";

test.use({ viewport: { width: 1440, height: 900 } });

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("espera la hoja de estilos de la página a la que llevó un clic sin hidratar", async ({
  page,
  signInToPanel,
}) => {
  await signInToPanel({ role: "admin" });
  await page.route("**/src/root.tsx*", async (route) => {
    await delay(SLOW_HYDRATION_MS);
    await route.continue();
  });
  await page.route(
    /critical\.css\?pathname=\/admin\/ajustes/,
    async (route) => {
      await delay(SLOW_STYLESHEET_MS);
      await route.continue();
    },
  );
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  const menuLink = page
    .getByRole("complementary")
    .getByRole("link", { name: "Ajustes" });
  await menuLink.click();
  await expect(page).toHaveURL("/admin/ajustes");
  await expect(menuLink).toBeVisible();

  await waitForSettledPage(page);

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
