import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../lib/database.types";
import { buildTestEmail, type UserRole } from "./database";
import type { LocalSupabaseStatus } from "./local-supabase-status";

// Sin importaciones con `~` ni módulos de servidor: también lo usa
// Playwright, fuera de Vite y sin el entorno del servidor.

export interface TestSessionOptions {
  readonly role: UserRole;
  readonly isActive?: boolean;
  readonly fullName?: string;
  /** Por defecto uno nuevo. Fíjalo solo si la prueba lo muestra. */
  readonly email?: string;
}

export interface TestSession {
  readonly userId: string;
  readonly email: string;
  /** Las cookies que el sitio le habría puesto al navegador al entrar. */
  readonly cookies: readonly {
    readonly name: string;
    readonly value: string;
  }[];
}

const WITHOUT_STORED_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

function createServiceClient(
  status: LocalSupabaseStatus,
): SupabaseClient<Database> {
  return createClient<Database>(
    status.API_URL,
    status.SECRET_KEY,
    WITHOUT_STORED_SESSION,
  );
}

function failOn(error: { message: string } | null, what: string): void {
  if (error !== null) {
    throw new Error(`No se pudo ${what}: ${error.message}`);
  }
}

// El registro público está apagado: la cuenta la crea el servidor, como en
// el sitio de verdad.
async function createAccount(
  status: LocalSupabaseStatus,
  {
    role,
    isActive = true,
    fullName,
    email = buildTestEmail(),
  }: TestSessionOptions,
): Promise<{ userId: string; email: string; password: string }> {
  const service = createServiceClient(status);
  const password = randomUUID();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  failOn(error, "crear el usuario de prueba");
  const userId = data.user?.id;
  if (userId === undefined) {
    throw new Error("Supabase no devolvió el usuario de prueba");
  }
  const update = await service
    .from("profiles")
    .update({ role, is_active: isActive, full_name: fullName ?? null })
    .eq("id", userId);
  failOn(update.error, "poner el rol al usuario de prueba");
  return { userId, email, password };
}

async function signIn(
  status: LocalSupabaseStatus,
  credentials: { email: string; password: string },
): Promise<TestSession["cookies"]> {
  const jar = new Map<string, string>();
  const client = createServerClient(status.API_URL, status.PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) jar.set(name, value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword(credentials);
  failOn(error, "entrar con el usuario de prueba");
  return [...jar].map(([name, value]) => ({ name, value }));
}

/** Crea en la base local un usuario con ese rol y le abre una sesión. */
export async function createTestSession(
  status: LocalSupabaseStatus,
  options: TestSessionOptions,
): Promise<TestSession> {
  const { userId, email, password } = await createAccount(status, options);
  const cookies = await signIn(status, { email, password });
  return { userId, email, cookies };
}

/** Desactiva a alguien que ya tiene la sesión abierta. */
export async function deactivateTestUser(
  status: LocalSupabaseStatus,
  userId: string,
): Promise<void> {
  const { error } = await createServiceClient(status)
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);
  failOn(error, "desactivar al usuario de prueba");
}

export async function deleteTestSessionUser(
  status: LocalSupabaseStatus,
  userId: string,
): Promise<void> {
  const service = createServiceClient(status);
  const entries = await service
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", userId);
  failOn(entries.error, "mirar la bitácora del usuario de prueba");
  // `audit_log` no deja borrar a su autor: se queda, desactivado, hasta el
  // siguiente `npm run db:reset`.
  if (entries.count !== 0) {
    await deactivateTestUser(status, userId);
    return;
  }
  const { error } = await service.auth.admin.deleteUser(userId);
  failOn(error, "borrar el usuario de prueba");
}

/** Las cookies de una sesión como la cabecera `Cookie` de una petición. */
export function toCookieHeader(cookies: TestSession["cookies"]): string {
  return cookies
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}
