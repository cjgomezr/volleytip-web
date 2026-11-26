import { describeActor, listFilterActors } from "../admin/audit-actor";
import {
  isRangeInverted,
  parseAuditFilters,
  parseAuditPage,
  type AuditFilterOptions,
  type AuditFilters,
} from "../admin/audit-filters";
import type {
  AuditEntryRecord,
  AuditPage,
  AuditRecord,
} from "../admin/audit-log";
import type { TypedSupabaseClient } from "../supabase/typed-client";

export const AUDIT_PAGE_SIZE = 50;
// Colombia no cambia de hora: el desfase es fijo todo el año.
const COLOMBIA_OFFSET = "-05:00";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_COLUMNS =
  "id, action, entity, created_at, actor:profiles(full_name, email)";
const ENTRY_COLUMNS =
  "id, action, entity, entity_id, details, created_at, actor:profiles(full_name, email)";

interface QueryResult {
  readonly error: { readonly message: string } | null;
  readonly status: number;
}

// Un `head` responde sin cuerpo: de su error solo se sabe el estado.
function failOn({ error, status }: QueryResult, what: string): void {
  if (error === null) return;
  throw new Error(
    `No se pudo leer ${what} de la bitácora (estado ${status}): ${error.message}`,
    { cause: error },
  );
}

type Condition = readonly [column: string, operator: string, value: string];

function listConditions({
  actorId,
  action,
  fromDay,
  toDay,
}: AuditFilters): readonly Condition[] {
  const conditions: (Condition | null)[] = [
    actorId === null ? null : ["actor_id", "eq", actorId],
    action === null ? null : ["action", "eq", action],
    fromDay === null
      ? null
      : ["created_at", "gte", `${fromDay}T00:00:00${COLOMBIA_OFFSET}`],
    toDay === null
      ? null
      : ["created_at", "lte", `${toDay}T23:59:59.999999${COLOMBIA_OFFSET}`],
  ];
  return conditions.filter((condition) => condition !== null);
}

interface Filterable<Query> {
  filter(column: string, operator: string, value: string): Query;
}

function applyFilters<Query extends Filterable<Query>>(
  query: Query,
  filters: AuditFilters,
): Query {
  return listConditions(filters).reduce(
    (filtered, condition) => filtered.filter(...condition),
    query,
  );
}

async function readFilterOptions(
  client: TypedSupabaseClient,
): Promise<AuditFilterOptions> {
  const [actors, actions] = await Promise.all([
    client.rpc("audit_log_actors"),
    client.rpc("audit_log_actions"),
  ]);
  failOn(actors, "las personas");
  failOn(actions, "las acciones");
  return {
    actors: listFilterActors(actors.data ?? []),
    actions: actions.data ?? [],
  };
}

async function countEntries(
  client: TypedSupabaseClient,
  filters: AuditFilters,
): Promise<number> {
  const result = await applyFilters(
    client.from("audit_log").select("id", { count: "exact", head: true }),
    filters,
  );
  failOn(result, "el conteo");
  if (result.count === null) {
    throw new Error("La base no devolvió el conteo de la bitácora");
  }
  return result.count;
}

async function readRows(
  client: TypedSupabaseClient,
  filters: AuditFilters,
  page: number,
): Promise<readonly AuditRecord[]> {
  const firstRow = (page - 1) * AUDIT_PAGE_SIZE;
  const result = await applyFilters(
    client.from("audit_log").select(LIST_COLUMNS),
    filters,
  )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(firstRow, firstRow + AUDIT_PAGE_SIZE - 1);
  failOn(result, "las entradas");
  return (result.data ?? []).map(({ created_at, actor, ...entry }) => ({
    ...entry,
    createdAt: created_at,
    actorName: describeActor(actor),
  }));
}

/**
 * Lee una página de la bitácora con el cliente de la sesión: RLS solo le da
 * filas a un admin. Los filtros y la página salen de la dirección.
 */
export async function readAuditPage(
  client: TypedSupabaseClient,
  params: URLSearchParams,
): Promise<AuditPage> {
  const options = await readFilterOptions(client);
  const filters = parseAuditFilters(params, options);
  // Un rango invertido no tiene entradas: no se consulta.
  const total = isRangeInverted(filters)
    ? 0
    : await countEntries(client, filters);
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  // Pedir más allá del final es un error para la API: se muestra la última.
  const page = Math.min(parseAuditPage(params), pageCount);
  const entries = total === 0 ? [] : await readRows(client, filters, page);
  return { entries, options, filters, page, pageCount, total };
}

/** Una entrada por su id, o `null` si no hay ninguna con él. */
export async function readAuditEntry(
  client: TypedSupabaseClient,
  id: string,
): Promise<AuditEntryRecord | null> {
  // La base rechaza con un error lo que no es un uuid.
  if (!UUID.test(id)) return null;
  const result = await client
    .from("audit_log")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  failOn(result, "la entrada");
  if (result.data === null) return null;
  const { created_at, entity_id, actor, ...entry } = result.data;
  return {
    ...entry,
    entityId: entity_id,
    createdAt: created_at,
    actorName: describeActor(actor),
  };
}
