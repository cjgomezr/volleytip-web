/**
 * Lo que comparten el comando del primer admin (`scripts/first-admin.ts`) y la
 * invitación del panel: cómo se guarda el correo de alguien del equipo y cómo
 * se deja su cuenta de Supabase Auth. El cliente tiene que usar la llave de
 * servicio: con el registro público apagado es la única forma de crear una
 * cuenta.
 *
 * Sin importaciones con `~` ni sin extensión: Node corre el comando sin Vite.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { TypedSupabaseClient } from "./supabase/typed-client.ts";

// El máximo de una dirección de correo (RFC 5321).
const MAX_EMAIL_LENGTH = 254;
// Nadie usa esa contraseña: al panel se entra con enlace o con Google.
const DISCARDED_PASSWORD_BYTES = 32;
// La forma en que se guarda un correo (DR-008).
const teamEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(MAX_EMAIL_LENGTH));

/** El correo normalizado, o `null` si no tiene forma de correo. */
export function parseTeamEmail(raw: string): string | null {
  const result = teamEmail.safeParse(raw);
  return result.success ? result.data : null;
}

function failOn(error: { message: string } | null, what: string): void {
  if (error !== null) {
    throw new Error(`No se pudo ${what}: ${error.message}`, { cause: error });
  }
}

/** Crea la cuenta con el correo ya confirmado. El perfil lo crea la base. */
export async function createConfirmedAccount(
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

/**
 * Deja en una cuenta que ya existía un acceso que nadie más tiene: el correo
 * confirmado, sin el que no se puede pedir el enlace, y una contraseña al
 * azar. Con el registro abierto un tercero pudo crear la cuenta con ese
 * correo, y su contraseña le abriría el panel.
 *
 * Cambiar la contraseña cierra además las sesiones de la cuenta: ninguna se
 * puede renovar, aunque un token de acceso ya emitido vale hasta que vence.
 * Es la única forma de revocarlas por id: `auth.admin.signOut` pide el token
 * de la persona.
 */
export async function secureAccount(
  client: TypedSupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client.auth.admin.updateUserById(userId, {
    email_confirm: true,
    password: randomBytes(DISCARDED_PASSWORD_BYTES).toString("base64url"),
  });
  failOn(error, "cambiar el acceso de la cuenta");
}
