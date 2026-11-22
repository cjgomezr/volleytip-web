import {
  isLocalSupabaseStatus,
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "../../src/testing/local-supabase-status";

const STATUS_CACHE_VARIABLE = "LOCAL_SUPABASE_STATUS_CACHE";

function readCachedStatus(): LocalSupabaseStatus | undefined {
  const cached = process.env[STATUS_CACHE_VARIABLE];
  if (cached === undefined) {
    return undefined;
  }
  const status: unknown = JSON.parse(cached);
  return isLocalSupabaseStatus(status) ? status : undefined;
}

/**
 * La URL y las llaves de la base local, preguntadas una sola vez. Lo recuerda
 * en una variable de entorno, que heredan los procesos hijos: Playwright
 * carga su configuración en el proceso principal y en cada worker, y sin esto
 * cada carga lanzaría Supabase CLI.
 */
export function readLocalSupabaseStatusOnce(): LocalSupabaseStatus {
  const cached = readCachedStatus();
  if (cached !== undefined) {
    return cached;
  }
  const status = readLocalSupabaseStatus();
  process.env[STATUS_CACHE_VARIABLE] = JSON.stringify(status);
  return status;
}
