import { defineConfig } from "@playwright/test";

import { buildPlaywrightEnv } from "./src/testing/playwright-env";
import { readLocalSupabaseStatusOnce } from "./tests/support/local-supabase-status-once";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const SERVER_BOOT_TIMEOUT_MS = 120_000;
// Escriben ajustes que cambian el sitio entero (mantenimiento): corren solas.
const SETTINGS_WRITES = "**/admin-settings-writes.spec.ts";
const TEXTS_WRITES = "**/admin-site-texts-writes.spec.ts";
const MARKETS_WRITES = "**/admin-markets-writes.spec.ts";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  projects: [
    {
      name: "sitio",
      testIgnore: [SETTINGS_WRITES, TEXTS_WRITES, MARKETS_WRITES],
    },
    // Depende de "sitio": empieza cuando las demás ya terminaron, así que
    // ninguna se cruza con el sitio en mantenimiento. Para correr solo estas:
    // `--project=ajustes-que-escriben --no-deps`.
    {
      name: "ajustes-que-escriben",
      testMatch: SETTINGS_WRITES,
      dependencies: ["sitio"],
    },
    // Cambia la barra de anuncios que las demás capturan y abre páginas
    // públicas: corre sola, sin un mantenimiento encendido a la vez. Para
    // correr solo esta: `--project=textos-que-escriben --no-deps`.
    {
      name: "textos-que-escriben",
      testMatch: TEXTS_WRITES,
      dependencies: ["ajustes-que-escriben"],
    },
    // Apaga un idioma del sitio entero y cambia el mercado y la tasa: corre
    // sola, al final. Para correr solo esta:
    // `--project=mercados-que-escriben --no-deps`.
    {
      name: "mercados-que-escriben",
      testMatch: MARKETS_WRITES,
      dependencies: ["textos-que-escriben"],
    },
  ],
  // El de Playwright sin el nombre del proyecto: las líneas base ya
  // aprobadas conservan su nombre.
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}",
  // Sólo Linux tiene línea base visual versionada: en cualquier otra
  // plataforma esto avisa que la comparación es informativa, y que la primera
  // corrida de un checkout limpio crea las capturas que falten sin fallar por
  // ello.
  globalSetup: "./tests/support/visual-baseline-global-setup.ts",
  // Quita de la base los datos que sembró la corrida, para que la base local
  // quede como la dejan las migraciones.
  globalTeardown: "./tests/support/site-fixtures-global-teardown.ts",
  use: {
    baseURL: APP_URL,
  },
  webServer: {
    command: "npm run dev",
    // El servidor valida su entorno al arrancar. Las pruebas visuales corren
    // con APP_ENV=test y no dependen del .env.local de nadie. Sí dependen de
    // la base local: las páginas leen de ella. Sin `npm run db:start` esto
    // falla aquí, con un mensaje que lo dice, en vez de capturar páginas a
    // medias.
    env: buildPlaywrightEnv(readLocalSupabaseStatusOnce()),
    url: APP_URL,
    // Off a propósito: si algo ya responde en esa URL, Playwright falla en vez
    // de adoptarlo. Un servidor ajeno en el puerto haría que la suite compare
    // baselines contra otra app. Para reusar el tuyo: FABRICA_REUSE_SERVER=1.
    reuseExistingServer: !!process.env.FABRICA_REUSE_SERVER,
    timeout: SERVER_BOOT_TIMEOUT_MS,
  },
});
