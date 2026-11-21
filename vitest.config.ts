import { defineConfig } from "vitest/config";

import {
  resolveIntegrationMode,
  type IntegrationMode,
} from "./src/testing/integration-mode.ts";
import { TEST_ENV } from "./tests/support/test-env.ts";

declare module "vitest" {
  export interface ProvidedContext {
    integrationMode: IntegrationMode;
  }
}

// El runner de los tests de la APP (`npm test`). Los del kit de la fábrica
// tienen el suyo en vitest.kit.config.mts (`npm run test:kit`), y *.spec.ts
// es de Playwright. Va aparte de vite.config.ts a propósito: el plugin de
// React Router espera un servidor de desarrollo y no hace falta para probar
// loaders y componentes sueltos.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "eslint-rules/**/*.test.ts"],
    environment: "node",
    // El módulo de entorno valida al cargarse. Las pruebas corren con
    // APP_ENV=test y no dependen del .env.local de nadie.
    env: TEST_ENV,
    // Las pruebas de integración (src/testing/describe-integration.ts) corren
    // solo con RUN_INTEGRATION_TESTS=1. Se lee aquí y no en src/, donde el
    // único archivo que lee process.env es env.server.ts.
    provide: {
      integrationMode: resolveIntegrationMode(
        process.env.RUN_INTEGRATION_TESTS,
      ),
    },
  },
});
