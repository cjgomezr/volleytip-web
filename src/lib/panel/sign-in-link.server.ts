import { createClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { serverEnv, type ServerEnv } from "../env.server";
import { SERVER_CLIENT_OPTIONS } from "../supabase/server-client-options.server";
import { createServiceSupabaseClient } from "../supabase/service-client.server";

/**
 * Pide a Supabase Auth el enlace de un solo uso para entrar al panel
 * (FR-058). La respuesta es la misma para un correo del equipo y para
 * cualquier otro, de modo que la pantalla no dice quién es del equipo
 * (AC-019).
 */

/** `sent` no promete un correo: es lo que se le dice a cualquiera. */
export type SignInLinkResult = "sent" | "unavailable";

export interface SignInLinkRequest {
  /** Ya normalizado: sin espacios alrededor y en minúsculas. */
  readonly email: string;
  /** Dirección completa a la que volver después de entrar, si pidió una. */
  readonly returnUrl: string | undefined;
}

export interface SignInLinkOptions {
  readonly env?: ServerEnv;
  /** Cuánto se espera a Supabase Auth antes de darlo por caído. */
  readonly authTimeoutMs?: number;
}

// Auth envía el correo antes de contestar, así que el margen es amplio.
const AUTH_TIMEOUT_MS = 10_000;
const SERVER_ERROR_STATUS = 500;

// Se lee con la llave de servicio porque todavía no hay sesión, y sin ella
// RLS no deja ver ningún perfil. De la fila solo sale un sí o un no.
async function isActiveTeamEmail(
  email: string,
  env: ServerEnv,
): Promise<boolean> {
  const { data, error } = await createServiceSupabaseClient(env)
    .from("profiles")
    .select("role, is_active")
    .eq("email", email)
    .maybeSingle();
  if (error !== null) {
    throw new Error("No se pudo comprobar quién pide el enlace", {
      cause: error,
    });
  }
  return data !== null && data.is_active && data.role !== "buyer";
}

function withTimeout(timeoutMs: number): typeof fetch {
  return (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

// Se pregunta por igual para cualquier correo: es lo único que decide si la
// pantalla dice que no se pudo enviar.
async function isAuthReachable(
  env: ServerEnv,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const response = await withTimeout(timeoutMs)(
      `${env.supabaseUrl}/auth/v1/health`,
      { headers: { apikey: env.supabaseAnonKey } },
    );
    return response.status < SERVER_ERROR_STATUS;
  } catch (error) {
    console.error("Supabase Auth no responde", error);
    return false;
  }
}

// El cliente público, sin PKCE: el enlace no depende de una cookie del
// navegador que lo pidió y sirve en cualquier otro.
async function sendLink(
  { email, returnUrl }: SignInLinkRequest,
  env: ServerEnv,
  timeoutMs: number,
): Promise<void> {
  const client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    ...SERVER_CLIENT_OPTIONS,
    global: { fetch: withTimeout(timeoutMs) },
  });
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: returnUrl },
  });
  if (error === null) return;
  // El correo nunca se escribe en el registro.
  console.error(
    `Supabase Auth no envió el enlace de entrada: estado ${String(error.status)}, código ${String(error.code)}`,
  );
}

/**
 * Envía el enlace solo si el correo es de un admin o staff activo. Lanza si no
 * se puede leer la base.
 *
 * La respuesta sale de comprobaciones iguales para cualquier correo, y el
 * envío no se espera: ni un fallo al enviar ni lo que tarda el correo dicen
 * quién es del equipo. Un envío fallido solo queda en el registro.
 */
export async function requestSignInLink(
  request: SignInLinkRequest,
  { env = serverEnv, authTimeoutMs = AUTH_TIMEOUT_MS }: SignInLinkOptions = {},
): Promise<SignInLinkResult> {
  if (!(await isAuthReachable(env, authTimeoutMs))) return "unavailable";
  if (await isActiveTeamEmail(request.email, env)) {
    sendLink(request, env, authTimeoutMs).catch((error: unknown) => {
      console.error("No se pudo enviar el enlace de entrada", error);
    });
  }
  return "sent";
}
