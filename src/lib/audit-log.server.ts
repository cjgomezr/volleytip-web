import type { Json } from "./database.types";
import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Datos de contexto de una entrada. Solo valores que caben en JSON. */
export type AuditDetails = { readonly [key: string]: Json | undefined };

/** Una acción del admin que queda en la bitácora (FR-067). */
export interface AuditEntry {
  /** Quién la hizo. `null` cuando no fue una persona (un webhook, una tarea). */
  readonly actorId: string | null;
  /** Qué hizo, como `entidad.verbo`: por ejemplo `order.refund`. */
  readonly action: string;
  /** Sobre qué tipo de cosa: por ejemplo `order`. */
  readonly entity: string;
  /** El id de esa cosa, si tiene uno. */
  readonly entityId?: string | null;
  /** Datos de contexto. Nunca secretos ni datos de pago. */
  readonly details?: AuditDetails | null;
}

/**
 * Escribe una entrada en `audit_log`. La fecha la pone la base de datos.
 *
 * Lanza si la base rechaza la entrada: una acción del admin que no queda
 * registrada es un fallo, no algo que se pueda ignorar. El segundo argumento
 * existe para las pruebas.
 */
export async function recordAuditEntry(
  entry: AuditEntry,
  client: TypedSupabaseClient = createServiceSupabaseClient(),
): Promise<void> {
  const { error } = await client.from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    details: entry.details ?? {},
  });

  if (error !== null) {
    throw new Error(
      `No se pudo registrar "${entry.action}" en la bitácora: ${error.message}`,
      { cause: error },
    );
  }
}
