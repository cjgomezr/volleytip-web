/** Las preguntas frecuentes de la base local, para las pruebas que escriben. */
import type { LocalSupabaseStatus } from "../../src/testing/local-supabase-status";

/** Deja la base sin preguntas, como la dejan las migraciones: la página real
 * se prueba vacía. */
export async function removeAllFaqs(
  status: LocalSupabaseStatus,
): Promise<void> {
  const response = await fetch(
    `${status.API_URL}/rest/v1/faqs?id=not.is.null`,
    {
      method: "DELETE",
      headers: {
        apikey: status.SECRET_KEY,
        Authorization: `Bearer ${status.SECRET_KEY}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `No se pudieron borrar las preguntas (${response.status}): ${await response.text()}`,
    );
  }
}
