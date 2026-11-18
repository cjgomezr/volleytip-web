import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv, type ServerEnv } from "../env.server";
import { SERVER_CLIENT_OPTIONS } from "./server-client-options.server";

/**
 * Cliente de Supabase con la llave pública. Respeta RLS: ve lo mismo que
 * vería un visitante anónimo. Es el cliente por defecto de loaders y actions.
 *
 * Se crea uno por petición. El argumento existe para las pruebas; el código
 * de la app lo llama sin argumentos.
 */
export function createAnonSupabaseClient(
  env: ServerEnv = serverEnv,
): SupabaseClient {
  return createClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    SERVER_CLIENT_OPTIONS,
  );
}
