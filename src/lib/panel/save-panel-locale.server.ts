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

async function writeLocale(
  client: TypedSupabaseClient,
  memberId: string,
  locale: string,
): Promise<void> {
  const { data, error } = await client
    .from("profiles")
    .update({ locale })
    .eq("id", memberId)
    .select("id");
  if (error !== null) failToSave(error.message, error);
  // RLS no falla cuando tapa una fila: simplemente no cambia ninguna.
  if (data.length !== 1) failToSave("no cambió ningún perfil");
}

// Un cambio sin entrada en la bitácora se deshace. Si se quedara, el
// reintento vería el idioma ya puesto y no lo registraría nunca.
async function recordOrRevert(
  { client, memberId, locale, auditClient }: PanelLocaleChange,
  previous: string,
): Promise<void> {
  try {
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
  } catch (auditError) {
    try {
      await writeLocale(client, memberId, previous);
    } catch (revertError) {
      throw new AggregateError(
        [auditError, revertError],
        `El idioma de ${memberId} quedó en "${locale}" sin entrada en la bitácora`,
      );
    }
    throw auditError;
  }
}

/**
 * Guarda en `profiles.locale` el idioma elegido en el panel y lo deja en la
 * bitácora (FR-067). Si ya era ese, no escribe nada. Lanza si el cambio o su
 * registro no quedan hechos. Si falla el registro intenta dejar el idioma como
 * estaba; si tampoco puede, lanza los dos errores y dice qué quedó guardado.
 * No son una sola transacción.
 */
export async function savePanelLocale(
  change: PanelLocaleChange,
): Promise<void> {
  const { client, memberId, locale } = change;
  const previous = await readLocale(client, memberId);
  if (previous === locale) return;
  await writeLocale(client, memberId, locale);
  await recordOrRevert(change, previous);
}
