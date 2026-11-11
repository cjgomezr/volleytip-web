import { defineConfig } from "vitest/config";

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
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
