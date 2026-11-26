/** Mensajes de contacto en la base local, para las pruebas de la bandeja. */
import type { LocalSupabaseStatus } from "../../src/testing/local-supabase-status";

export interface SeededMessage {
  readonly name: string;
  readonly email: string;
  readonly reason: string;
  readonly body: string;
}

async function request(
  status: LocalSupabaseStatus,
  query: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(`${status.API_URL}/rest/v1/messages?${query}`, {
    ...init,
    headers: {
      apikey: status.SECRET_KEY,
      Authorization: `Bearer ${status.SECRET_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  if (!response.ok) {
    throw new Error(
      `No se pudo tocar la tabla messages (${response.status}): ${await response.text()}`,
    );
  }
  return response;
}

/** Guarda los mensajes y devuelve sus ids, en el mismo orden. */
export async function insertMessages(
  status: LocalSupabaseStatus,
  messages: readonly SeededMessage[],
): Promise<readonly string[]> {
  const rows = messages.map((message) => ({
    ...message,
    locale: "es",
    privacy_version: "2026-11",
  }));
  const response = await request(status, "select=id", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  const saved = (await response.json()) as { id: string }[];
  return saved.map(({ id }) => id);
}

/** Quita los mensajes cuyo correo es de ese dominio. */
export async function removeMessages(
  status: LocalSupabaseStatus,
  emailDomain: string,
): Promise<void> {
  await request(status, `email=like.*@${emailDomain}`, { method: "DELETE" });
}
