import { defineConfig } from "@playwright/test";

import { buildPlaywrightEnv } from "./src/testing/playwright-env";
import { readLocalSupabaseStatusOnce } from "./tests/support/local-supabase-status-once";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const SERVER_BOOT_TIMEOUT_MS = 120_000;
// Las specs que cambian datos que las demás leen o capturan.
const SHARED_DATA_WRITES = "**/*.writes.spec.ts";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  // El primer proyecto no tiene nombre a propósito: el nombre de un proyecto
  // se pega al de cada captura. El segundo corre cuando el primero terminó,
  // así ninguna prueba ve a medias lo que otra está escribiendo.
  projects: [
    { name: "", testIgnore: SHARED_DATA_WRITES },
    {
      name: "escrituras",
      testMatch: SHARED_DATA_WRITES,
      dependencies: [""],
    },
  ],
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
