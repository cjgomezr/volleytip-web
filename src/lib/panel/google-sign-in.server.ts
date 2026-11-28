import { isAuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";

import { serverEnv } from "../env.server";
import type { Language } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { admitTeamMember, type AdmittedMember } from "./admit-member.server";
import type { GoogleNotice } from "./google-notice";
import { RETURN_PARAM } from "./return-path";

/**
 * Entrar al panel con Google (FR-058): el flujo con código (PKCE) que se
 * canjea en el servidor. Google solo comprueba que la persona es dueña de un
 * correo; quién entra lo siguen decidiendo el registro público apagado en
 * Supabase y la comprobación del perfil después del canje.
 */

export type GoogleReturnResult =
  | ({ readonly status: "signed_in" } & AdmittedMember)
  | { readonly status: GoogleNotice };

// Con el registro apagado, así rechaza Supabase un correo que nadie invitó.
const SIGNUP_DISABLED_CODE = "signup_disabled";
// El código que entrega Auth es un UUID. Lo que no se le parezca no se le manda.
const AUTH_CODE_FORMAT = /^[A-Za-z0-9_-]{8,200}$/;

interface GoogleSignInStart {
  readonly language: Language;
  /** La página del panel a la que volver, ya validada; `null` si ninguna. */
  readonly returnPath: string | null;
}

// La vuelta sale de la dirección pública configurada, nunca de la petición.
function buildReturnUrl({ language, returnPath }: GoogleSignInStart): string {
  const url = new URL(
    getPanelPath("adminSignInGoogleReturn", language),
    serverEnv.siteOrigin,
  );
  if (returnPath !== null) url.searchParams.set(RETURN_PARAM, returnPath);
  return url.href;
}

/**
 * La dirección de Supabase que lleva a Google. Deja en las cookies de
 * `client` el secreto con el que la vuelta canjeará el código, así que solo
 * el navegador que empezó puede terminar.
 */
export async function startGoogleSignIn(
  client: TypedSupabaseClient,
  start: GoogleSignInStart,
): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: buildReturnUrl(start) },
  });
  if (error !== null) {
    throw new Error("Supabase Auth no armó la entrada con Google", {
      cause: error,
    });
  }
  return data.url;
}

// Con `error` Google o Supabase dicen que no hubo entrada: la persona canceló,
// algo falló o el correo no está invitado.
function readProviderRefusal(params: URLSearchParams): GoogleNotice | null {
  if (!params.has("error") && !params.has("error_code")) return null;
  const code = params.get("error_code");
  if (code === SIGNUP_DISABLED_CODE) return "denied";
  // El código es de una lista fija de Auth; la descripción no se registra.
  console.warn(
    `La entrada con Google volvió con error: ${code ?? "sin código"}`,
  );
  return "failed";
}

// Falso si el código no abrió una sesión. Sin la cookie del navegador que
// empezó (o ya gastada) ni siquiera se le pregunta a Supabase.
async function exchangeCode(
  client: TypedSupabaseClient,
  code: string,
): Promise<boolean> {
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error === null) return true;
  if (!isAuthPKCECodeVerifierMissingError(error)) {
    // Ni el código ni el correo se escriben en el registro.
    console.error(
      `Supabase Auth no canjeó la vuelta de Google: estado ${String(error.status)}, código ${String(error.code)}`,
    );
  }
  return false;
}

/**
 * Termina la entrada con lo que trae la dirección de vuelta. Solo un admin o
 * staff activo queda con sesión en las cookies de `client`. Lanza, sin dejar
 * sesión, si no puede leer su perfil.
 */
export async function completeGoogleSignIn(
  client: TypedSupabaseClient,
  params: URLSearchParams,
): Promise<GoogleReturnResult> {
  const refusal = readProviderRefusal(params);
  if (refusal !== null) return { status: refusal };
  const code = params.get("code");
  if (code === null || !AUTH_CODE_FORMAT.test(code))
    return { status: "failed" };
  if (!(await exchangeCode(client, code))) return { status: "failed" };
  const admitted = await admitTeamMember(client);
  return admitted === null
    ? { status: "denied" }
    : { status: "signed_in", ...admitted };
}
