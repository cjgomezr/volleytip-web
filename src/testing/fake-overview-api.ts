/**
 * La API de Supabase de mentira para las pruebas del resumen del panel:
 * contesta los conteos, la bitácora y los envíos descartados. Las consultas
 * contra la base local de verdad viven en
 * `src/db/panel-overview.integration.test.ts`.
 */
export interface FakeAuditRow {
  readonly id: string;
  readonly action: string;
  readonly created_at: string;
  readonly actor: {
    readonly full_name: string | null;
    readonly email: string;
  } | null;
}

export interface FakeRejectionRow {
  readonly form: string;
  readonly reason: string;
  readonly count: number;
}

export type OverviewTable =
  "messages" | "waitlists" | "audit_log" | "form_rejections";

export interface FakeOverviewData {
  readonly newMessages?: number;
  readonly appWaitlist?: number;
  readonly campWaitlist?: number;
  readonly auditRows?: readonly FakeAuditRow[];
  readonly rejectionRows?: readonly FakeRejectionRow[];
  /** Las tablas cuya consulta responde con error. */
  readonly failing?: readonly OverviewTable[];
}

export interface FakeOverviewApi {
  readonly fetch: typeof fetch;
  readonly requests: { readonly method: string; readonly url: URL }[];
}

function answerCount(count: number): Response {
  return new Response(null, {
    status: 200,
    headers: { "Content-Range": `*/${count}` },
  });
}

function answerTable(url: URL, data: FakeOverviewData): Response {
  const table = url.pathname.replace("/rest/v1/", "") as OverviewTable;
  if (data.failing?.includes(table)) {
    return Response.json({ message: "falló a propósito" }, { status: 500 });
  }
  if (table === "messages") return answerCount(data.newMessages ?? 0);
  if (table === "waitlists") {
    const isApp = url.searchParams.get("kind") === "eq.app";
    return answerCount((isApp ? data.appWaitlist : data.campWaitlist) ?? 0);
  }
  if (table === "audit_log") return Response.json(data.auditRows ?? []);
  if (table === "form_rejections") {
    return Response.json(data.rejectionRows ?? []);
  }
  return Response.json([]);
}

export function createOverviewApi(
  data: FakeOverviewData = {},
): FakeOverviewApi {
  const requests: FakeOverviewApi["requests"] = [];
  return {
    requests,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      requests.push({ method: request.method, url });
      return answerTable(url, data);
    },
  };
}
