import type { Language } from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";

interface PanelLocaleChange {
  /** El cliente con la sesión de la persona: aplican sus políticas RLS. */
  readonly client: TypedSupabaseClient;
  readonly memberId: string;
  readonly locale: Language;
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

/**
 * Guarda en `profiles.locale` el idioma elegido en el panel y devuelve el que
 * había, para que quien llama deje el cambio en la bitácora. Si ya era ese, no
 * escribe nada. Lanza si el cambio no queda hecho.
 */
export async function savePanelLocale({
  client,
  memberId,
  locale,
}: PanelLocaleChange): Promise<string> {
  const previous = await readLocale(client, memberId);
  if (previous !== locale) await writeLocale(client, memberId, locale);
  return previous;
}
