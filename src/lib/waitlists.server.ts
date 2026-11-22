import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Las listas que existen: la de la app y el "Avísame" del próximo camp. */
export type WaitlistKind = "app" | "camp_notify";

export interface WaitlistEntry {
  readonly kind: WaitlistKind;
  readonly email: string;
  readonly locale: string;
  /** Dos letras mayúsculas (ISO 3166), o nulo si no se sabe. */
  readonly countryCode: string | null;
  readonly city: string | null;
  /** La versión de la política de privacidad que aceptó la persona. */
  readonly privacyVersion: string;
}

/**
 * Inscribe un correo en una lista (FR-035, FR-082). Devuelve lo mismo si el
 * correo es nuevo o ya estaba inscrito: quien llama no debe poder saberlo, o
 * el formulario serviría para averiguar quién está en la lista.
 *
 * Usa la llave de servicio porque la tabla no admite escrituras por la API.
 * Si la base falla, lanza el error.
 */
export async function joinWaitlist(
  entry: WaitlistEntry,
  client: TypedSupabaseClient = createServiceSupabaseClient(),
): Promise<void> {
  const { error } = await client.rpc("enroll_waitlist", {
    p_kind: entry.kind,
    p_email: entry.email,
    p_locale: entry.locale,
    p_country_code: entry.countryCode ?? undefined,
    p_city: entry.city ?? undefined,
    p_privacy_version: entry.privacyVersion,
  });
  if (error !== null) {
    throw new Error(
      `No se pudo inscribir en la lista "${entry.kind}": ${error.message}`,
      { cause: error },
    );
  }
}
