import { defineConfig } from "@playwright/test";

import { readLocalSupabaseStatus } from "./src/testing/local-supabase-status";
import { buildPlaywrightEnv } from "./src/testing/playwright-env";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const SERVER_BOOT_TIMEOUT_MS = 120_000;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  // Sólo Linux tiene línea base visual versionada: en cualquier otra
  // plataforma esto avisa que la comparación es informativa, y que la primera
  // corrida de un checkout limpio crea las capturas que falten sin fallar por
  // ello.
  globalSetup: "./tests/support/visual-baseline-global-setup.ts",
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
    env: buildPlaywrightEnv(readLocalSupabaseStatus()),
    url: APP_URL,
    // Off a propósito: si algo ya responde en esa URL, Playwright falla en vez
    // de adoptarlo. Un servidor ajeno en el puerto haría que la suite compare
    // baselines contra otra app. Para reusar el tuyo: FABRICA_REUSE_SERVER=1.
    reuseExistingServer: !!process.env.FABRICA_REUSE_SERVER,
    timeout: SERVER_BOOT_TIMEOUT_MS,
  },
});
