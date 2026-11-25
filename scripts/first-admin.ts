/**
 * Deja un correo como admin activo del panel. Es la lógica de
 * `npm run admin:create` (scripts/admin-create.ts), con el cliente inyectado.
 * El cliente tiene que usar la llave de servicio: con el registro público
 * apagado es la única forma de crear una cuenta.
 *
 * Las importaciones llevan extensión porque Node corre esto sin Vite.
 */
import { randomBytes } from "node:crypto";
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
  /** La cuenta estaba sin confirmar y quedó confirmada. */
  readonly confirmedEmail: boolean;
}

const ADMIN_STATE: ProfileState = { role: "admin", isActive: true };
const AUDIT_ACTION = "profile.grant_admin";
// Nadie usa esa contraseña: al panel se entra con enlace o con Google.
const DISCARDED_PASSWORD_BYTES = 32;
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

/** Corre un paso y, si falla, le dice a quien opera en qué quedó todo. */
async function explainFailure<Result>(
  situation: string,
  step: () => Promise<Result>,
): Promise<Result> {
  try {
    return await step();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${reason}\n${situation} Repite el comando.`, {
      cause: error,
    });
  }
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

async function isEmailConfirmed(
  client: TypedSupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client.auth.admin.getUserById(userId);
  failOn(error, "leer la cuenta");
  return Boolean(data.user?.email_confirmed_at);
}

/**
 * Deja en la cuenta un acceso que nadie más tiene: el correo confirmado, sin
 * el que no se puede pedir el enlace, y una contraseña al azar. Con el
 * registro abierto un tercero pudo crear la cuenta con ese correo, y su
 * contraseña le abriría el panel.
 */
async function secureAccount(
  client: TypedSupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client.auth.admin.updateUserById(userId, {
    email_confirm: true,
    password: randomBytes(DISCARDED_PASSWORD_BYTES).toString("base64url"),
  });
  failOn(error, "cambiar el acceso de la cuenta");
}

interface Grant {
  readonly profileId: string;
  /** Cómo estaba el perfil; `null` si la cuenta es nueva. */
  readonly previous: ProfileState | null;
  readonly needsEmailConfirmation: boolean;
}

async function recordGrant(
  client: TypedSupabaseClient,
  { profileId, previous, needsEmailConfirmation }: Grant,
): Promise<void> {
  await recordAuditEntry(
    {
      actorId: null,
      action: AUDIT_ACTION,
      entity: "profile",
      entityId: profileId,
      details: {
        createdAccount: previous === null,
        confirmedEmail: needsEmailConfirmation,
        previous: previous && { ...previous },
      },
    },
    client,
  );
}

async function applyGrant(
  client: TypedSupabaseClient,
  { profileId, previous }: Grant,
): Promise<void> {
  // Una cuenta recién creada ya nace confirmada y sin contraseña.
  if (previous !== null) {
    await secureAccount(client, profileId);
  }
  await setProfileState(client, profileId, ADMIN_STATE);
}

/**
 * Registra el cambio y después lo hace. En ese orden ningún fallo, ni un
 * proceso cortado a la mitad, deja un admin sin entrada en la bitácora. Lo
 * peor que queda es una entrada de más, y al repetir se registra otra.
 */
async function grantAdmin(
  client: TypedSupabaseClient,
  grant: Grant,
): Promise<void> {
  const account =
    grant.previous === null
      ? `La cuenta quedó creada (perfil ${grant.profileId}), sin permisos de admin.`
      : `No se cambió el perfil ${grant.profileId}.`;
  await explainFailure(account, () => recordGrant(client, grant));
  await explainFailure(
    "El cambio ya está en la bitácora, pero puede no haber quedado completo.",
    () => applyGrant(client, grant),
  );
}

/** Crea la cuenta si hace falta y deja su perfil como admin activo. */
export async function ensureFirstAdmin(
  client: TypedSupabaseClient,
  email: string,
): Promise<FirstAdminOutcome> {
  const profile = await findProfile(client, email);
  if (profile === null) {
    const profileId = await explainFailure(
      "Puede que la cuenta haya quedado creada.",
      () => createAccount(client, email),
    );
    await grantAdmin(client, {
      profileId,
      previous: null,
      needsEmailConfirmation: false,
    });
    return { kind: "created", profileId, confirmedEmail: false };
  }
  const { id: profileId, role, isActive } = profile;
  const needsEmailConfirmation = !(await isEmailConfirmed(client, profileId));
  if (role === ADMIN_STATE.role && isActive && !needsEmailConfirmation) {
    return { kind: "unchanged", profileId, confirmedEmail: false };
  }
  await grantAdmin(client, {
    profileId,
    previous: { role, isActive },
    needsEmailConfirmation,
  });
  return {
    kind: "promoted",
    profileId,
    confirmedEmail: needsEmailConfirmation,
  };
}
