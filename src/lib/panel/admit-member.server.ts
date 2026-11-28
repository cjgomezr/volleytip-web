import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type Language,
} from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { closeSession } from "./close-session.server";
import { identifyVisitor, type PanelMember } from "./visitor.server";

export interface AdmittedMember {
  readonly member: PanelMember;
  /** El idioma guardado en su perfil. */
  readonly language: Language;
}

async function readProfileLanguage(
  client: TypedSupabaseClient,
  memberId: string,
): Promise<Language> {
  const { data, error } = await client
    .from("profiles")
    .select("locale")
    .eq("id", memberId)
    .maybeSingle();
  if (error !== null || data === null) {
    throw new Error("No se pudo leer el idioma del perfil", { cause: error });
  }
  return isSupportedLanguage(data.locale) ? data.locale : DEFAULT_LANGUAGE;
}

async function admitOrSignOut(
  client: TypedSupabaseClient,
): Promise<AdmittedMember | null> {
  const visitor = await identifyVisitor(client);
  if (visitor.kind !== "member") {
    await closeSession(client);
    return null;
  }
  const language = await readProfileLanguage(client, visitor.member.id);
  return { member: visitor.member, language };
}

// Si no se pudo comprobar quién entró, la sesión no se queda. El fallo que
// sale es el de la comprobación; el del cierre queda en el registro.
async function abandonSession(client: TypedSupabaseClient): Promise<void> {
  try {
    await closeSession(client);
  } catch (error) {
    console.error("No se pudo cerrar la sesión de un canje fallido", error);
  }
}

/**
 * El candado que sigue a todo canje (enlace del correo o Google): con la
 * sesión recién abierta, se queda solo si es de un admin o staff activo. A
 * cualquier otro se le cierra antes de responder y sale `null`. Lanza, sin
 * dejar sesión, si no puede leer su perfil.
 */
export async function admitTeamMember(
  client: TypedSupabaseClient,
): Promise<AdmittedMember | null> {
  try {
    return await admitOrSignOut(client);
  } catch (error) {
    await abandonSession(client);
    throw error;
  }
}
