import { isAuthApiError, type AuthError } from "@supabase/supabase-js";

import type { TypedSupabaseClient } from "../supabase/typed-client";
import { admitTeamMember, type AdmittedMember } from "./admit-member.server";

/** Canjea en el servidor el token del enlace que llegó por correo. */

export type RedeemResult =
  | ({ readonly status: "signed_in" } & AdmittedMember)
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
  const admitted = await admitTeamMember(client);
  return admitted === null
    ? { status: "invalid_link" }
    : { status: "signed_in", ...admitted };
}
