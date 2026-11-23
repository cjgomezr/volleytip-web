import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, type BrowserContext, type Page } from "@playwright/test";

import { TEST_ENV } from "./test-env";

export { expect, type Page } from "@playwright/test";

// La foto del mockup hace de cualquier imagen del CDN: el dominio de las
// pruebas no existe, y una captura con la imagen rota (o a medio pedir)
// cambiaría según la red de quien corra la suite.
const STAND_IN_IMAGE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs",
  "mockups",
  "assets",
  "camilo-estudio.jpg",
);

const TURNSTILE_REQUESTS = "https://challenges.cloudflare.com/**";
// Un Turnstile de mentira que anota lo que la página le pide. El de verdad
// pinta su widget cuando la red se lo deja, y la página mide distinto de una
// corrida a otra.
const TURNSTILE_STAND_IN = `
  window.turnstileCalls = [];
  window.turnstile = {
    render(container, options) {
      window.turnstileCalls.push({ method: "render", sitekey: options.sitekey });
      return "widget-de-prueba";
    },
    reset() { window.turnstileCalls.push({ method: "reset" }); },
    remove() { window.turnstileCalls.push({ method: "remove" }); },
  };
`;

/**
 * Responde desde aquí lo que un contexto pide fuera del sitio: las imágenes
 * del CDN y el script de Turnstile. El `test` de abajo lo hace solo con el
 * contexto de cada prueba; una prueba que abre el suyo con
 * `browser.newContext()` tiene que llamarlo.
 */
export async function routeExternalRequests(
  context: BrowserContext,
): Promise<void> {
  await context.route(`https://${TEST_ENV.IMAGE_CDN_HOST}/**`, (route) =>
    route.fulfill({ path: STAND_IN_IMAGE, contentType: "image/jpeg" }),
  );
  await context.route(TURNSTILE_REQUESTS, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: TURNSTILE_STAND_IN,
    }),
  );
}

/**
 * Espera a que todas las imágenes de la página estén pintadas. Las que cargan
 * al acercarse a la pantalla no se piden en una captura de página completa,
 * que no hace scroll: la captura saldría con o sin foto según el momento.
 * Una imagen rota hace fallar la espera en vez de quedar en la línea base.
 */
export async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map(async (image) => {
        image.loading = "eager";
        await image.decode();
      }),
    );
  });
}

/**
 * El `test` de todas las specs. Ninguna prueba sale a la red por una imagen
 * del CDN ni por Turnstile.
 */
export const test = base.extend<{ externalRequests: undefined }>({
  externalRequests: [
    async ({ context }, use) => {
      await routeExternalRequests(context);
      await use(undefined);
    },
    { auto: true },
  ],
});
