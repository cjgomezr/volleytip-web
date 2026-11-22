import type { ServerEnv } from "~/lib/env.server";
import { createServiceSupabaseClient } from "~/lib/supabase/service-client.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";

import { readLocalSupabaseStatus } from "./local-supabase-status";
import { buildTestServerEnv } from "./test-server-env";

/**
 * Cliente de Supabase con la llave de servicio de la base local. Es para las
 * pruebas de integración de las funciones de servidor que la necesitan.
 */
export function createLocalServiceClient(): TypedSupabaseClient {
  const status = readLocalSupabaseStatus();
  const localEnv: ServerEnv = buildTestServerEnv({
    supabaseUrl: status.API_URL,
    supabaseAnonKey: status.PUBLISHABLE_KEY,
    supabaseServiceRoleKey: status.SECRET_KEY,
  });
  return createServiceSupabaseClient(localEnv);
}
