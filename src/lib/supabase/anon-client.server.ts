import { createClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { serverEnv, type ServerEnv } from "../env.server";
import { SERVER_CLIENT_OPTIONS } from "./server-client-options.server";
import type { TypedSupabaseClient } from "./typed-client";

/**
 * Cliente de Supabase con la llave pública. Respeta RLS: ve lo mismo que
 * vería un visitante anónimo. Es el cliente por defecto de loaders y actions.
 *
 * Se crea uno por petición. El argumento existe para las pruebas; el código
 * de la app lo llama sin argumentos.
 */
export function createAnonSupabaseClient(
  env: ServerEnv = serverEnv,
): TypedSupabaseClient {
  return createClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    SERVER_CLIENT_OPTIONS,
  );
}
