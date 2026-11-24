import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Los motivos por los que alguien escribe desde el formulario de contacto. */
export type MessageReason =
  "order" | "camps" | "brands" | "suggest_tip" | "vball_tour" | "other";

export interface MessageEntry {
  readonly reason: MessageReason;
  readonly name: string;
  readonly email: string;
  readonly whatsapp: string | null;
  /** Dos letras mayúsculas (ISO 3166), o nulo si no se sabe. */
  readonly countryCode: string | null;
  /** Texto de una persona: se guarda tal cual y nunca se interpreta como HTML. */
  readonly body: string;
  /** Los campos propios del motivo (número de pedido, organización...). */
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
  readonly locale: string;
  /** La versión de la política de privacidad que aceptó la persona. */
  readonly privacyVersion: string;
}

/**
 * Guarda un mensaje del formulario de contacto (FR-053, FR-064). Usa la llave
 * de servicio porque la tabla no admite escrituras por la API. Si la base
 * rechaza la fila o falla, lanza el error.
 */
export async function saveMessage(
  entry: MessageEntry,
  client: TypedSupabaseClient = createServiceSupabaseClient(),
): Promise<void> {
  const { error } = await client.rpc("save_message", {
    p_reason: entry.reason,
    p_name: entry.name,
    p_email: entry.email,
    p_whatsapp: entry.whatsapp ?? undefined,
    p_country_code: entry.countryCode ?? undefined,
    p_body: entry.body,
    p_payload: entry.payload,
    p_locale: entry.locale,
    p_privacy_version: entry.privacyVersion,
  });
  if (error !== null) {
    throw new Error(
      `No se pudo guardar el mensaje de motivo "${entry.reason}": ${error.message}`,
      { cause: error },
    );
  }
}
