import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base } from "@playwright/test";

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

/**
 * El `test` de todas las specs. Responde desde el disco las imágenes que la
 * página pide al CDN, para que ninguna prueba salga a la red por ellas.
 */
export const test = base.extend<{ cdnImages: undefined }>({
  cdnImages: [
    async ({ context }, use) => {
      await context.route(`https://${TEST_ENV.IMAGE_CDN_HOST}/**`, (route) =>
        route.fulfill({ path: STAND_IN_IMAGE, contentType: "image/jpeg" }),
      );
      await use(undefined);
    },
    { auto: true },
  ],
});
