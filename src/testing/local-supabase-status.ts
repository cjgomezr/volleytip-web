import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Sin importaciones con `~`: también lo carga la configuración de Playwright,
// fuera de Vite.
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SUPABASE_CLI = fileURLToPath(
  new URL("../../node_modules/supabase/dist/supabase.js", import.meta.url),
);
const STATUS_TIMEOUT_MS = 30_000;

export interface LocalSupabaseStatus {
  readonly API_URL: string;
  readonly PUBLISHABLE_KEY: string;
  readonly SECRET_KEY: string;
}

function isLocalSupabaseStatus(value: unknown): value is LocalSupabaseStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const status = value as Record<string, unknown>;
  return (
    typeof status.API_URL === "string" &&
    typeof status.PUBLISHABLE_KEY === "string" &&
    typeof status.SECRET_KEY === "string"
  );
}

function parseStatusOutput(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error("`supabase status` no devolvió JSON", { cause: error });
  }
}

/** Pide a Supabase CLI la URL y las llaves de la base local que está arriba.
 * Así la llave de servicio local no queda escrita en el repo. */
export function readLocalSupabaseStatus(): LocalSupabaseStatus {
  const result = spawnSync(
    process.execPath,
    [SUPABASE_CLI, "status", "--output", "json"],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: STATUS_TIMEOUT_MS },
  );
  if (result.status !== 0) {
    throw new Error(
      `\`supabase status\` falló. ¿Está arriba la base local (npm run db:start)?\n${result.stderr}`,
    );
  }
  const status = parseStatusOutput(result.stdout);
  if (!isLocalSupabaseStatus(status)) {
    throw new Error(
      "`supabase status` no devolvió API_URL, PUBLISHABLE_KEY y SECRET_KEY",
    );
  }
  return status;
}
