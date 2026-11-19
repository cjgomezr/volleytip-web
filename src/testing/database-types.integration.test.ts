import { expect, it } from "vitest";

import {
  checkDatabaseTypes,
  DATABASE_TYPES_PATH,
  STALE_TYPES_MESSAGE,
} from "../../scripts/db-types.ts";
import { describeIntegration } from "./describe-integration";

// Genera los tipos con Supabase CLI de verdad, que tarda unos segundos.
const GENERATION_TIMEOUT_MS = 60_000;

describeIntegration("tipos de la base", () => {
  it(
    "los generados ahora desde la base local coinciden con el archivo versionado",
    async () => {
      const isCurrent = await checkDatabaseTypes(DATABASE_TYPES_PATH);

      expect(isCurrent, STALE_TYPES_MESSAGE).toBe(true);
    },
    GENERATION_TIMEOUT_MS,
  );
});
