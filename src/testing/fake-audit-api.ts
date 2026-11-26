/**
 * La API de Supabase de mentira para las pruebas de la pantalla de bitácora:
 * contesta las opciones de los filtros, el conteo y las entradas, y guarda
 * cada petición para comprobar qué se le pidió a la base. Los filtros de
 * verdad se prueban contra la base local en
 * `src/db/audit-log-reading.integration.test.ts`.
 */
export interface FakeAuditActor {
  readonly id: string;
  readonly full_name: string | null;
  readonly email: string;
}

export interface FakeAuditEntry {
  readonly id: string;
  readonly action: string;
  readonly entity: string;
  readonly entity_id: string | null;
  readonly details: unknown;
  readonly created_at: string;
  readonly actor: Omit<FakeAuditActor, "id"> | null;
}

export interface FakeAuditData {
  readonly actors?: readonly FakeAuditActor[];
  readonly actions?: readonly string[];
  /** Cuántas entradas cuenta la base. Por defecto, las de `entries`. */
  readonly total?: number;
  /** Las filas de la página pedida, ya en el orden en que las da la base. */
  readonly entries?: readonly FakeAuditEntry[];
  readonly isFailing?: boolean;
}

export interface FakeAuditApi {
  readonly fetch: typeof fetch;
  readonly requests: { readonly method: string; readonly url: URL }[];
}

function answerEntries(url: URL, data: FakeAuditData): Response {
  const id = url.searchParams.get("id");
  const entries = data.entries ?? [];
  return Response.json(
    id === null ? entries : entries.filter((entry) => id === `eq.${entry.id}`),
  );
}

function answer(method: string, url: URL, data: FakeAuditData): Response {
  if (data.isFailing) {
    return Response.json({ message: "falló a propósito" }, { status: 500 });
  }
  if (url.pathname === "/rest/v1/rpc/audit_log_actors") {
    return Response.json(data.actors ?? []);
  }
  if (url.pathname === "/rest/v1/rpc/audit_log_actions") {
    return Response.json(data.actions ?? []);
  }
  if (url.pathname !== "/rest/v1/audit_log") return Response.json([]);
  if (method !== "HEAD") return answerEntries(url, data);
  const total = data.total ?? data.entries?.length ?? 0;
  return new Response(null, {
    status: 200,
    headers: { "Content-Range": `*/${total}` },
  });
}

export function createAuditApi(data: FakeAuditData = {}): FakeAuditApi {
  const requests: FakeAuditApi["requests"] = [];
  return {
    requests,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      requests.push({ method: request.method, url });
      return answer(request.method, url, data);
    },
  };
}
