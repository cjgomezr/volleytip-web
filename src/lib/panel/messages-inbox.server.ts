import { isUuid } from "../is-uuid";
import type { InboxQuery } from "../admin/messages";
import type { Database } from "../database.types";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { COUNT_ONLY, takeCount } from "./database-count.server";

// Las lecturas de la bandeja. Usan el cliente de la sesión: las políticas RLS
// de `messages` solo dejan a un admin.

export const INBOX_PAGE_SIZE = 50;

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

const LIST_COLUMNS = "id, name, email, reason, status, created_at, body";
const DETAIL_COLUMNS =
  "id, reason, name, email, whatsapp, country_code, body, payload, locale, privacy_version, status, answered_at, created_at, answerer:profiles(full_name, email)";

export type InboxRow = Pick<
  MessageRow,
  "id" | "name" | "email" | "reason" | "status" | "created_at" | "body"
>;

export type StoredMessage = Pick<
  MessageRow,
  | "id"
  | "reason"
  | "name"
  | "email"
  | "whatsapp"
  | "country_code"
  | "body"
  | "payload"
  | "locale"
  | "privacy_version"
  | "status"
  | "answered_at"
  | "created_at"
> & {
  /** Quien respondió, según su perfil. */
  readonly answerer: {
    readonly full_name: string | null;
    readonly email: string | null;
  } | null;
};

export interface InboxPage {
  readonly rows: readonly InboxRow[];
  readonly total: number;
  /** La página que se leyó: la pedida, o la última si se pidió una de más. */
  readonly page: number;
  readonly pageCount: number;
}

/** Dice si un texto puede ser el id de un mensaje. Con otra cosa la base
 * rechaza la consulta en vez de no encontrar nada. */
export function isMessageId(id: string): boolean {
  return isUuid(id);
}

// Lo buscado es texto: `%`, `_` y `\` no son comodines. PostgREST convierte
// `*` en `%` y no deja escaparlo, así que se busca como un carácter
// cualquiera. Las comillas impiden que una coma o un paréntesis agreguen otro
// filtro.
function buildSearchFilter(search: string): string {
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&").replaceAll("*", "_")}%`;
  const quoted = `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
  return `name.ilike.${quoted},email.ilike.${quoted}`;
}

interface Filterable<Query> {
  eq(column: "reason" | "status", value: string): Query;
  or(filters: string): Query;
}

function applyFilters<Query extends Filterable<Query>>(
  query: Query,
  { reason, status, search }: InboxQuery,
): Query {
  let filtered = query;
  if (reason !== null) filtered = filtered.eq("reason", reason);
  if (status !== null) filtered = filtered.eq("status", status);
  return search === "" ? filtered : filtered.or(buildSearchFilter(search));
}

async function readRows(
  client: TypedSupabaseClient,
  query: InboxQuery,
  page: number,
): Promise<readonly InboxRow[]> {
  const first = (page - 1) * INBOX_PAGE_SIZE;
  const { data, error } = await applyFilters(
    client.from("messages").select(LIST_COLUMNS),
    query,
  )
    .order("created_at", { ascending: false })
    // Dos mensajes del mismo instante no pueden cambiar de página.
    .order("id", { ascending: false })
    .range(first, first + INBOX_PAGE_SIZE - 1);
  if (error !== null) {
    throw new Error(`No se pudieron leer los mensajes: ${error.message}`, {
      cause: error,
    });
  }
  return data;
}

/** Una página de la bandeja, del mensaje más reciente al más antiguo. */
export async function readInbox(
  client: TypedSupabaseClient,
  query: InboxQuery,
): Promise<InboxPage> {
  const total = await takeCount(
    applyFilters(client.from("messages").select("id", COUNT_ONLY), query),
  ).catch((error: unknown) => {
    throw new Error("No se pudieron contar los mensajes", { cause: error });
  });
  const pageCount = Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE));
  // Pedir un rango más allá del final es un error de la API.
  const page = Math.min(query.page, pageCount);
  const rows = total === 0 ? [] : await readRows(client, query, page);
  return { rows, total, page, pageCount };
}

/** Un mensaje completo, o `null` si no existe. */
export async function readMessage(
  client: TypedSupabaseClient,
  id: string,
): Promise<StoredMessage | null> {
  if (!isMessageId(id)) return null;
  const { data, error } = await client
    .from("messages")
    .select(DETAIL_COLUMNS)
    .eq("id", id);
  if (error !== null) {
    throw new Error(`No se pudo leer el mensaje ${id}: ${error.message}`, {
      cause: error,
    });
  }
  return data[0] ?? null;
}

/** Los mensajes sin responder. */
export function countNewMessages(client: TypedSupabaseClient): Promise<number> {
  return takeCount(
    client.from("messages").select("id", COUNT_ONLY).eq("status", "new"),
  );
}
