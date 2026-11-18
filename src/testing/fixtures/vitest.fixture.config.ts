import { defineConfig } from "vitest/config";

import baseConfig from "../../../vitest.config.ts";

// La misma configuración de `npm test`, pero recogiendo solo el fixture que
// `npm test` ignora. Así el Vitest hijo de describe-integration.test.ts pasa
// por el mismo camino que decide el modo de integración.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/testing/fixtures/*.fixture.ts"],
  },
});
