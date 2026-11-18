import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv, type ServerEnv } from "../env.server";
import { SERVER_CLIENT_OPTIONS } from "./server-client-options.server";

/**
 * Cliente de Supabase con la llave de servicio. SALTA RLS: lee y escribe
 * cualquier fila. Úsalo solo cuando la operación no puede hacerse con el
 * cliente público, y nunca devuelvas al navegador lo que lea sin filtrarlo.
 *
 * Solo lo importan módulos `*.server.ts` (lo vigila portability.test.ts): una
 * ruta que lo necesite pasa por un módulo de servidor con nombre propio, para
 * que cada uso de la llave de servicio quede a la vista.
 *
 * Se crea uno por petición. El argumento existe para las pruebas.
 */
export function createServiceSupabaseClient(
  env: ServerEnv = serverEnv,
): SupabaseClient {
  return createClient(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    SERVER_CLIENT_OPTIONS,
  );
}
