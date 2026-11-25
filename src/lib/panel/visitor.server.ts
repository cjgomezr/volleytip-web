import {
  isAuthApiError,
  isAuthSessionMissingError,
  type AuthError,
  type User,
} from "@supabase/supabase-js";

import type { TypedSupabaseClient } from "../supabase/typed-client";

export interface PanelMember {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly role: "admin" | "staff";
}

/** Quién pide una página del panel. */
export type Visitor =
  /** Sin sesión, o de alguien del equipo que está desactivado. */
  | { readonly kind: "withoutAccess" }
  /** Con sesión, pero no es del equipo: para esa persona el panel no existe. */
  | { readonly kind: "outsider" }
  | { readonly kind: "member"; readonly member: PanelMember };

// Con estos estados Supabase dice que la sesión no sirve: token inválido o
// vencido, refresco revocado, usuario borrado. Cualquier otro (429, 500) es
// un fallo del servicio y no dice nada de la persona.
const REJECTED_SESSION_STATUSES: readonly number[] = [400, 401, 403, 404];

function isRejectedSession(error: AuthError): boolean {
  if (isAuthSessionMissingError(error)) return true;
  return (
    isAuthApiError(error) && REJECTED_SESSION_STATUSES.includes(error.status)
  );
}

// `getUser` le pregunta a Supabase Auth por el token. Leer la cookie
// (`getSession`) no basta: cualquiera puede escribir una.
async function verifyUser(client: TypedSupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error === null) return data.user;
  if (isRejectedSession(error)) return null;
  throw new Error("No se pudo verificar la sesión con Supabase Auth", {
    cause: error,
  });
}

/**
 * Verifica la sesión contra Supabase y lee de `profiles` el rol y el estado.
 * Se llama en cada petición: nada de esto sale del token, así que desactivar
 * a alguien se nota enseguida.
 */
export async function identifyVisitor(
  client: TypedSupabaseClient,
): Promise<Visitor> {
  const user = await verifyUser(client);
  if (user === null) return { kind: "withoutAccess" };
  const { data: profile, error } = await client
    .from("profiles")
    .select("role, is_active, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (error !== null) {
    throw new Error("No se pudo leer el perfil de la sesión", { cause: error });
  }
  if (profile === null || profile.role === "buyer") return { kind: "outsider" };
  if (!profile.is_active) return { kind: "withoutAccess" };
  return {
    kind: "member",
    member: {
      id: user.id,
      email: String(profile.email),
      fullName: profile.full_name?.trim() || null,
      role: profile.role,
    },
  };
}
