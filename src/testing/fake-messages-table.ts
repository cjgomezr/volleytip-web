/**
 * La tabla `messages` del Supabase de mentira. Solo entiende lo que las
 * pruebas de las rutas necesitan: buscar por id, contar los de un estado y
 * cambiar el estado. Los filtros, el orden y la paginación de verdad se
 * prueban contra la base local (`src/db/panel-messages.integration.test.ts`).
 */
export interface FakeMessageRow {
  readonly id: string;
  readonly reason: string;
  readonly name: string;
  readonly email: string;
  readonly whatsapp: string | null;
  readonly country_code: string | null;
  readonly body: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly locale: string;
  readonly privacy_version: string;
  readonly status: "new" | "answered" | "archived";
  readonly answered_at: string | null;
  readonly answerer: {
    readonly full_name: string | null;
    readonly email: string;
  } | null;
  readonly created_at: string;
}

export const SAMPLE_MESSAGE: FakeMessageRow = {
  id: "0b7c1f9e-3f0a-4c1e-9a7d-2f4b6c8d0e12",
  reason: "order",
  name: "Laura Restrepo",
  email: "laura@prueba.volleytip.test",
  whatsapp: "+57 300 123 4567",
  country_code: "CO",
  body: "Hola.\nNo me ha llegado el pedido.",
  payload: { orderNumber: "VT-1042" },
  locale: "es",
  privacy_version: "2026-11",
  status: "new",
  answered_at: null,
  answerer: null,
  // 2026-11-26 a las 10:30 en Colombia.
  created_at: "2026-11-26T15:30:00Z",
};

export interface FakeMessagesOptions {
  readonly messages?: readonly FakeMessageRow[];
  /** Estado con que fallan las lecturas de `messages`. */
  readonly messagesReadFailureStatus?: number;
  /** Estado con que falla el cambio de un mensaje. */
  readonly messageWriteFailureStatus?: number;
  /** Otra persona cambia el estado entre la lectura y la escritura. */
  readonly statusChangedMeanwhile?: FakeMessageRow["status"];
  /** La escritura no toca ninguna fila, como cuando RLS la tapa. */
  readonly isMessageWriteIgnored?: boolean;
}

export interface FakeMessageWrite {
  /** La búsqueda de la petición: los filtros del cambio. */
  readonly search: string;
  readonly body: unknown;
  readonly authorization: string | null;
}

export interface FakeMessagesTable {
  readonly answer: (request: Request) => Promise<Response>;
  /** Cada cambio pedido a un mensaje, aceptado o no. */
  readonly messageWrites: FakeMessageWrite[];
}

const FILTERED_COLUMNS = ["id", "status", "reason"] as const;

function matches(row: FakeMessageRow, url: URL): boolean {
  return FILTERED_COLUMNS.every((column) => {
    const filter = url.searchParams.get(column);
    return filter === null || filter === `eq.${row[column]}`;
  });
}

export function createMessagesTable(
  options: FakeMessagesOptions,
): FakeMessagesTable {
  let rows = [...(options.messages ?? [])];
  const messageWrites: FakeMessageWrite[] = [];

  function read(request: Request): Response {
    const status = options.messagesReadFailureStatus;
    if (status) return Response.json({ message: "falló" }, { status });
    const found = rows.filter((row) => matches(row, new URL(request.url)));
    const headers = { "Content-Range": `*/${found.length}` };
    return request.method === "HEAD"
      ? new Response(null, { headers })
      : Response.json(found, { headers });
  }

  async function write(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = (await request.json()) as Partial<FakeMessageRow>;
    messageWrites.push({
      search: url.search,
      body,
      authorization: request.headers.get("authorization"),
    });
    const status = options.messageWriteFailureStatus;
    if (status) return Response.json({ message: "falló" }, { status });
    if (options.isMessageWriteIgnored) return Response.json([]);
    const meanwhile = options.statusChangedMeanwhile;
    if (meanwhile) {
      rows = rows.map((row) => ({ ...row, status: meanwhile }));
    }
    const changed = rows.filter((row) => matches(row, url));
    rows = rows.map((row) =>
      changed.includes(row) ? { ...row, ...body } : row,
    );
    return Response.json(changed.map(({ id }) => ({ id })));
  }

  return {
    answer: async (request) =>
      request.method === "PATCH" ? write(request) : read(request),
    messageWrites,
  };
}
