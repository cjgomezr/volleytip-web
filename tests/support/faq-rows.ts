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

/** Pone una pregunta de primera, como si otra persona la hubiera subido. */
export async function putFaqFirst(
  status: LocalSupabaseStatus,
  question: string,
): Promise<void> {
  const headers = {
    apikey: status.SECRET_KEY,
    Authorization: `Bearer ${status.SECRET_KEY}`,
    "Content-Type": "application/json",
  };
  const query = new URLSearchParams({
    select: "faq_id",
    question: `eq.${question}`,
  });
  const found = await fetch(
    `${status.API_URL}/rest/v1/faq_translations?${query}`,
    { headers },
  );
  const [row] = (await found.json()) as { faq_id: string }[];
  if (row === undefined) throw new Error(`No está la pregunta "${question}"`);
  const moved = await fetch(
    `${status.API_URL}/rest/v1/faqs?id=eq.${row.faq_id}`,
    { method: "PATCH", headers, body: JSON.stringify({ sort_order: 0 }) },
  );
  if (!moved.ok) {
    throw new Error(`No se pudo mover la pregunta (${moved.status})`);
  }
}
