import { recordAuditEntry } from "../audit-log.server";
import type { Language } from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";

interface PanelLocaleChange {
  /** El cliente con la sesión de la persona: aplican sus políticas RLS. */
  readonly client: TypedSupabaseClient;
  readonly memberId: string;
  readonly locale: Language;
  /** Solo las pruebas lo cambian. La bitácora se escribe con la llave de
   * servicio porque `audit_log` no deja insertar a ninguna sesión. */
  readonly auditClient?: TypedSupabaseClient;
}

function failToSave(reason: string, cause?: unknown): never {
  throw new Error(`No se pudo guardar el idioma del panel: ${reason}`, {
    cause,
  });
}

async function readLocale(
  client: TypedSupabaseClient,
  memberId: string,
): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("locale")
    .eq("id", memberId)
    .maybeSingle();
  if (error !== null) failToSave(error.message, error);
  if (data === null) failToSave("no se encontró el perfil");
  return data.locale;
}

async function writeLocale({
  client,
  memberId,
  locale,
}: PanelLocaleChange): Promise<void> {
  const { data, error } = await client
    .from("profiles")
    .update({ locale })
    .eq("id", memberId)
    .select("id");
  if (error !== null) failToSave(error.message, error);
  // RLS no falla cuando tapa una fila: simplemente no cambia ninguna.
  if (data.length !== 1) failToSave("no cambió ningún perfil");
}

/**
 * Guarda en `profiles.locale` el idioma elegido en el panel y lo deja en la
 * bitácora (FR-067). Si ya era ese, no escribe nada. Lanza si el cambio o su
 * registro no quedan hechos.
 */
export async function savePanelLocale(
  change: PanelLocaleChange,
): Promise<void> {
  const { client, memberId, locale, auditClient } = change;
  const previous = await readLocale(client, memberId);
  if (previous === locale) return;
  await writeLocale(change);
  await recordAuditEntry(
    {
      actorId: memberId,
      action: "profile.set_locale",
      entity: "profile",
      entityId: memberId,
      details: { before: { locale: previous }, after: { locale } },
    },
    auditClient,
  );
}
