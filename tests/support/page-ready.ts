/**
 * Esperar a que una página del servidor de desarrollo termine de acomodarse
 * antes de hacer clic en ella o de medirla (#144).
 *
 * La página llega con una hoja de estilos provisional. Al hidratar, React
 * Router la quita y quedan los estilos que inyecta Vite: las fuentes se
 * vuelven a cargar y el contenido se mueve unos píxeles, así que un clic en
 * ese momento presiona un enlace y suelta fuera de él. Y tras una navegación
 * que carga otra página, el contenido se puede consultar antes de que llegue
 * esa hoja: axe lo mide sin estilos, aunque en pantalla no se vea todavía.
 */
import { expect, type Page } from "@playwright/test";

const DEV_STYLESHEET = "[data-react-router-critical-css]";
// El servidor de desarrollo compila lo que la página pide, y bajo carga tarda
// más que los 5 segundos de una espera corriente.
const HYDRATION_TIMEOUT_MS = 15_000;

/**
 * Vuelve cuando la página ya tiene sus estilos, hidrató y cargó sus fuentes.
 * Tras un clic que navega, comprueba antes la dirección nueva: si no, puede
 * responder por la página anterior. No sirve sin JavaScript: sin hidratar, la
 * hoja provisional no se quita nunca.
 */
export async function waitForSettledPage(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect(
    page.locator(DEV_STYLESHEET),
    "la página no terminó de hidratar",
  ).toHaveCount(0, { timeout: HYDRATION_TIMEOUT_MS });
  await page.evaluate(async () => {
    // Medir obliga a aplicar los estilos que quedaron, y con eso a pedir las
    // fuentes. Sin esto, `fonts.ready` puede responder por la carga anterior.
    document.body.getBoundingClientRect();
    await document.fonts.ready;
  });
}
