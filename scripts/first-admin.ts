/**
 * Deja un correo como admin activo del panel. Es la lógica de
 * `npm run admin:create` (scripts/admin-create.ts), con el cliente inyectado.
 * El cliente tiene que usar la llave de servicio: con el registro público
 * apagado es la única forma de crear una cuenta.
 *
 * Las importaciones llevan extensión porque Node corre esto sin Vite.
 */
import { z } from "zod";

import { recordAuditEntry } from "../src/lib/audit-log.server.ts";
import type { Database } from "../src/lib/database.types.ts";
import type { TypedSupabaseClient } from "../src/lib/supabase/typed-client.ts";

type UserRole = Database["public"]["Enums"]["user_role"];

interface ProfileState {
  readonly role: UserRole;
  readonly isActive: boolean;
}

interface Profile extends ProfileState {
  readonly id: string;
}

export interface FirstAdminOutcome {
  readonly kind: "created" | "promoted" | "unchanged";
  readonly profileId: string;
}

const ADMIN_STATE: ProfileState = { role: "admin", isActive: true };
// Como nace un perfil: lo pone el disparador de alta de la base.
const NEW_PROFILE_STATE: ProfileState = { role: "buyer", isActive: true };
const AUDIT_ACTION = "profile.grant_admin";
// La forma en que se guarda un correo (DR-008).
const adminEmail = z.string().trim().toLowerCase().pipe(z.email());

/** El correo normalizado, o `null` si no tiene forma de correo. */
export function parseAdminEmail(raw: string): string | null {
  const result = adminEmail.safeParse(raw);
  return result.success ? result.data : null;
}

function failOn(error: { message: string } | null, what: string): void {
  if (error !== null) {
    throw new Error(`No se pudo ${what}: ${error.message}`, { cause: error });
  }
}

async function findProfile(
  client: TypedSupabaseClient,
  email: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, is_active")
    .eq("email", email)
    .maybeSingle();
  failOn(error, "buscar el perfil");
  return data === null
    ? null
    : { id: data.id, role: data.role, isActive: data.is_active };
}

/** Crea la cuenta con el correo ya confirmado. El perfil lo crea la base. */
async function createAccount(
  client: TypedSupabaseClient,
  email: string,
): Promise<string> {
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  failOn(error, "crear la cuenta");
  if (data.user === null) {
    throw new Error("No se pudo crear la cuenta: Supabase no la devolvió");
  }
  return data.user.id;
}

async function setProfileState(
  client: TypedSupabaseClient,
  profileId: string,
  { role, isActive }: ProfileState,
): Promise<void> {
  // `single` hace fallar la escritura que no encontró ningún perfil.
  const { error } = await client
    .from("profiles")
    .update({ role, is_active: isActive })
    .eq("id", profileId)
    .select("id")
    .single();
  failOn(error, `poner el rol ${role} al perfil ${profileId}`);
}

interface Grant {
  readonly profileId: string;
  /** Cómo estaba el perfil; `null` si la cuenta es nueva. */
  readonly previous: ProfileState | null;
}

/**
 * Sube el perfil a admin y lo registra. Si la bitácora falla, deja el perfil
 * como estaba: así al repetir el comando el cambio vuelve a hacerse y queda
 * registrado, en vez de responder "ya es admin".
 */
async function grantAdmin(
  client: TypedSupabaseClient,
  { profileId, previous }: Grant,
): Promise<void> {
  await setProfileState(client, profileId, ADMIN_STATE);
  try {
    await recordAuditEntry(
      {
        actorId: null,
        action: AUDIT_ACTION,
        entity: "profile",
        entityId: profileId,
        details: {
          createdAccount: previous === null,
          previous: previous && { ...previous },
        },
      },
      client,
    );
  } catch (auditError) {
    await restoreProfile(client, profileId, previous ?? NEW_PROFILE_STATE);
    throw auditError;
  }
}

async function restoreProfile(
  client: TypedSupabaseClient,
  profileId: string,
  state: ProfileState,
): Promise<void> {
  try {
    await setProfileState(client, profileId, state);
  } catch (error) {
    throw new Error(
      `El perfil ${profileId} quedó como admin sin entrada en la bitácora: falló el registro y también deshacer el cambio. Anótalo a mano.`,
      { cause: error },
    );
  }
}

/** Crea la cuenta si hace falta y deja su perfil como admin activo. */
export async function ensureFirstAdmin(
  client: TypedSupabaseClient,
  email: string,
): Promise<FirstAdminOutcome> {
  const profile = await findProfile(client, email);
  if (profile === null) {
    const profileId = await createAccount(client, email);
    await grantAdmin(client, { profileId, previous: null });
    return { kind: "created", profileId };
  }
  const { id: profileId, role, isActive } = profile;
  if (role === ADMIN_STATE.role && isActive) {
    return { kind: "unchanged", profileId };
  }
  await grantAdmin(client, { profileId, previous: { role, isActive } });
  return { kind: "promoted", profileId };
}
