import { isAuthApiError, type AuthError } from "@supabase/supabase-js";

import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type Language,
} from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { closeSession } from "./close-session.server";
import { identifyVisitor, type PanelMember } from "./visitor.server";

/** Canjea en el servidor el token del enlace que llegó por correo. */

export type RedeemResult =
  | {
      readonly status: "signed_in";
      readonly member: PanelMember;
      /** El idioma guardado en su perfil. */
      readonly language: Language;
    }
  /** Vencido, ya usado, alterado o de alguien que no puede entrar. */
  | { readonly status: "invalid_link" }
  /** Auth falló: el enlace puede seguir sirviendo. */
  | { readonly status: "unavailable" };

// Con estos estados Supabase dice que el token no sirve. Cualquier otro (429,
// 500, la red) es un fallo del servicio y no dice nada del enlace.
const REJECTED_TOKEN_STATUSES: readonly number[] = [400, 401, 403, 404, 422];

function isRejectedToken(error: AuthError): boolean {
  return (
    isAuthApiError(error) && REJECTED_TOKEN_STATUSES.includes(error.status)
  );
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

// Con la sesión recién abierta: se queda solo si es de alguien del equipo.
async function admitMember(client: TypedSupabaseClient): Promise<RedeemResult> {
  const visitor = await identifyVisitor(client);
  if (visitor.kind !== "member") {
    await closeSession(client);
    return { status: "invalid_link" };
  }
  const language = await readProfileLanguage(client, visitor.member.id);
  return { status: "signed_in", member: visitor.member, language };
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
 * Cambia el token por una sesión en las cookies de `client`. Solo queda con
 * sesión un admin o staff activo: a cualquier otro se le cierra enseguida, por
 * si dejó de serlo después de pedir el enlace. Lanza, sin dejar sesión, si no
 * puede leer su perfil.
 */
export async function redeemSignInLink(
  client: TypedSupabaseClient,
  tokenHash: string,
): Promise<RedeemResult> {
  // `token_hash` no depende del navegador que pidió el enlace.
  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (error !== null) {
    if (isRejectedToken(error)) return { status: "invalid_link" };
    console.error(
      `Supabase Auth no canjeó un enlace de entrada: estado ${String(error.status)}`,
    );
    return { status: "unavailable" };
  }
  try {
    return await admitMember(client);
  } catch (error) {
    await abandonSession(client);
    throw error;
  }
}
