import { beforeAll, describe, inject } from "vitest";

import { assertLocalDatabaseResponds } from "./local-database";

/**
 * `describe` para pruebas que necesitan la base local de Supabase. Es el
 * único lugar que decide si un bloque de integración corre, se salta o falla:
 *
 * - Sin `RUN_INTEGRATION_TESTS`, el bloque se salta y Vitest lo cuenta como
 *   saltado en el resumen.
 * - Con `RUN_INTEGRATION_TESTS=1`, el bloque corre. Si la base local no
 *   responde, falla diciendo cómo levantarla; nunca se salta en silencio.
 *
 * El modo llega de `vitest.config.ts`, que es quien lee la variable de
 * entorno: en `src/` solo `env.server.ts` lee `process.env`.
 */
export function describeIntegration(
  name: string,
  defineTests: () => void,
): void {
  const suite = inject("integrationMode") === "run" ? describe : describe.skip;

  suite(name, () => {
    beforeAll(() => assertLocalDatabaseResponds());
    defineTests();
  });
}
