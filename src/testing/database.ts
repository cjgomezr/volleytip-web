import { randomUUID } from "node:crypto";
import postgres from "postgres";

import { LOCAL_DATABASE_URL } from "./local-database";

export type Database = postgres.Sql;
export type Transaction = postgres.TransactionSql;

/** Quién hace la consulta, tal como lo ve la base detrás de la API. */
export type Session =
  | { readonly kind: "anonymous" }
  | { readonly kind: "signedIn"; readonly userId: string }
  | { readonly kind: "service" };

export type UserRole = "admin" | "staff" | "buyer";

export interface TestUser {
  readonly id: string;
  readonly email: string;
}

interface TestUserOptions {
  readonly role?: UserRole;
  readonly isActive?: boolean;
}

interface SessionSettings {
  readonly postgresRole: "anon" | "authenticated" | "service_role";
  readonly claims: Readonly<Record<string, string>>;
}

// Dominio de los correos de prueba: no existe y deja claro de dónde vienen.
const TEST_EMAIL_DOMAIN = "prueba.volleytip.test";

// Usuarios creados desde este módulo. Vitest carga el módulo una vez por
// archivo de pruebas, así que cada archivo lleva la cuenta de los suyos.
const createdUserIds: string[] = [];

/** Conexión a la base local como superusuario. Solo para preparar datos y
 * para comprobar el resultado; lo que se prueba corre con `runAs`. */
export function connectToLocalDatabase(): Database {
  return postgres(LOCAL_DATABASE_URL, { max: 1, onnotice: () => undefined });
}

export function buildTestEmail(): string {
  return `${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

/** Devuelve la única fila que se esperaba, o lanza si no llegó. */
export function takeOnlyRow<Row>(rows: readonly Row[], what: string): Row {
  const [row] = rows;
  if (row === undefined || rows.length !== 1) {
    throw new Error(
      `Se esperaba una fila de ${what} y llegaron ${rows.length}`,
    );
  }
  return row;
}

function describeSession(session: Session): SessionSettings {
  switch (session.kind) {
    case "anonymous":
      return { postgresRole: "anon", claims: { role: "anon" } };
    case "signedIn":
      return {
        postgresRole: "authenticated",
        claims: { sub: session.userId, role: "authenticated" },
      };
    case "service":
      return { postgresRole: "service_role", claims: { role: "service_role" } };
  }
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
  const { postgresRole, claims } = describeSession(session);
  let outcome: { readonly value: Result } | undefined;

  await database.begin(async (transaction) => {
    await transaction`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await transaction`select set_config('role', ${postgresRole}, true)`;
    outcome = { value: await work(transaction) };
  });

  if (outcome === undefined) {
    throw new Error("La transacción terminó sin ejecutar el trabajo pedido");
  }
  return outcome.value;
}

/** Inserta un usuario en Supabase Auth, como lo haría un registro. Su perfil
 * lo crea el disparador de la base. Devuelve el id del usuario. */
export async function insertAuthUser(
  database: Database,
  email: string | null,
): Promise<string> {
  const rows = await database<{ id: string }[]>`
    insert into auth.users (id, email) values (gen_random_uuid(), ${email})
    returning id
  `;
  const { id } = takeOnlyRow(rows, "auth.users");
  createdUserIds.push(id);
  return id;
}

/** Crea un usuario con el rol y el estado pedidos. */
export async function createTestUser(
  database: Database,
  options: TestUserOptions = {},
): Promise<TestUser> {
  const email = buildTestEmail();
  const id = await insertAuthUser(database, email);
  const { role = "buyer", isActive = true } = options;
  await database`
    update public.profiles set role = ${role}, is_active = ${isActive}
    where id = ${id}
  `;
  return { id, email };
}

/**
 * Borra los usuarios que creó este archivo de pruebas. Solo los suyos: los
 * archivos de integración corren en paralelo contra la misma base, y borrar
 * por dominio se llevaría los que otro archivo todavía está usando.
 *
 * Los que tienen entradas en la bitácora se quedan: `audit_log` no deja
 * borrar a su autor. Desaparecen con el siguiente `npm run db:reset`.
 */
export async function deleteTestUsers(database: Database): Promise<void> {
  const userIds = createdUserIds.splice(0);
  if (userIds.length === 0) {
    return;
  }
  await database`
    delete from auth.users
    where id in ${database(userIds)}
      and id not in (
        select actor_id from public.audit_log where actor_id is not null
      )
  `;
}
