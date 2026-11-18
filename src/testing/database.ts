import { randomUUID } from "node:crypto";
import postgres from "postgres";

import { LOCAL_DATABASE_URL } from "./local-database";

export type Database = postgres.Sql;
export type Transaction = postgres.TransactionSql;

/** Quién hace la consulta, tal como lo ve la base detrás de la API. */
export type Session =
  | { readonly kind: "anonymous" }
  | { readonly kind: "signedIn"; readonly userId: string };

export type UserRole = "admin" | "staff" | "buyer";

export interface TestUser {
  readonly id: string;
  readonly email: string;
}

interface TestUserOptions {
  readonly role?: UserRole;
  readonly isActive?: boolean;
}

// Todo usuario de prueba vive bajo este dominio, para poder borrarlos todos
// al terminar sin tocar nada más.
const TEST_EMAIL_DOMAIN = "prueba.volleytip.test";

/** Conexión a la base local como superusuario. Solo para preparar datos y
 * para comprobar el resultado; lo que se prueba corre con `runAs`. */
export function connectToLocalDatabase(): Database {
  return postgres(LOCAL_DATABASE_URL, { max: 1, onnotice: () => undefined });
}

export function buildTestEmail(): string {
  return `${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

/**
 * Corre `work` como lo haría una petición que llega por la API de Supabase:
 * con el rol de Postgres y los datos del token que PostgREST pone en cada
 * transacción. Así las políticas RLS se evalúan de verdad. Los cambios se
 * confirman al terminar; si `work` lanza, se revierten.
 */
export async function runAs<Result>(
  database: Database,
  session: Session,
  work: (transaction: Transaction) => Promise<Result>,
): Promise<Result> {
  const role = session.kind === "signedIn" ? "authenticated" : "anon";
  const claims =
    session.kind === "signedIn" ? { sub: session.userId, role } : { role };

  const result = await database.begin(async (transaction) => {
    await transaction`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await transaction`select set_config('role', ${role}, true)`;
    return work(transaction);
  });
  return result as Result;
}

/** Crea un usuario en Supabase Auth, como lo haría un registro. Su perfil lo
 * crea el disparador de la base. */
export async function createTestUser(
  database: Database,
  options: TestUserOptions = {},
): Promise<TestUser> {
  const email = buildTestEmail();
  const [user] = await database<{ id: string }[]>`
    insert into auth.users (id, email) values (gen_random_uuid(), ${email})
    returning id
  `;
  if (user === undefined) {
    throw new Error("auth.users no devolvió el usuario creado");
  }
  const { role = "buyer", isActive = true } = options;
  await database`
    update public.profiles set role = ${role}, is_active = ${isActive}
    where id = ${user.id}
  `;
  return { id: user.id, email };
}

export async function deleteTestUsers(database: Database): Promise<void> {
  await database`
    delete from auth.users where email like ${`%@${TEST_EMAIL_DOMAIN}`}
  `;
}
