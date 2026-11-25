import type { TypedSupabaseClient } from "../supabase/typed-client";

/**
 * Invalida en Supabase la sesión de la petición y borra sus cookies. Cierra
 * solo esta (`local`), no las de otros dispositivos. Falla en voz alta: no se
 * da por cerrada una sesión que sigue viva.
 */
export async function closeSession(client: TypedSupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error !== null) {
    throw new Error("Supabase Auth no pudo cerrar la sesión", { cause: error });
  }
}
