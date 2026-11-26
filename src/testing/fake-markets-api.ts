import { vi } from "vitest";

import {
  stubSupabase,
  type FakeSupabase,
  type FakeSupabaseOptions,
} from "./fake-supabase";

export interface FakeLanguageRow {
  readonly code: string;
  readonly name: string;
  readonly is_default: boolean;
  readonly is_active: boolean;
}

export interface FakeMarketRow {
  readonly id: string;
  readonly country_code: string;
  readonly currency: string;
  readonly default_locale: string;
  readonly ships_physical: boolean;
  readonly payment_methods: readonly string[];
  readonly is_active: boolean;
}

export const SPANISH_ROW: FakeLanguageRow = {
  code: "es",
  name: "Español",
  is_default: true,
  is_active: true,
};

export const ENGLISH_ROW: FakeLanguageRow = {
  code: "en",
  name: "English",
  is_default: false,
  is_active: true,
};

export const COLOMBIA_ROW: FakeMarketRow = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  country_code: "CO",
  currency: "COP",
  default_locale: "es",
  ships_physical: true,
  payment_methods: ["card", "pse"],
  is_active: true,
};

export interface FakeMarketsOptions extends FakeSupabaseOptions {
  readonly languages?: readonly FakeLanguageRow[];
  readonly markets?: readonly FakeMarketRow[];
  /** El mensaje con que la base rechaza cualquier cambio de esas tablas. */
  readonly writeRejection?: string;
  /** El cambio no toca ninguna fila, como cuando RLS lo tapa. */
  readonly isWriteIgnored?: boolean;
}

export interface FakeTableWrite {
  /** La ruta con su búsqueda. */
  readonly path: string;
  readonly body: unknown;
  readonly authorization: string | null;
}

export interface FakeMarketsApi extends FakeSupabase {
  /** Cada cambio pedido a `languages` o a `markets`. */
  readonly tableWrites: FakeTableWrite[];
}

const CHECK_VIOLATION = "23514";

// Solo el filtro `columna=eq.valor`, que es el que usa el panel.
function filterRows(rows: readonly object[], url: URL): object[] {
  return rows.filter((row) =>
    [...url.searchParams].every(([column, filter]) => {
      if (!filter.startsWith("eq.")) return true;
      const value = (row as Record<string, unknown>)[column];
      return String(value) === filter.slice("eq.".length);
    }),
  );
}

/** Las tablas `languages` y `markets` de mentira, encima de `stubSupabase`,
 * que ya contesta por `settings`. Las reglas de la base se prueban contra la
 * base de verdad. */
export function stubMarketsApi({
  languages = [SPANISH_ROW, ENGLISH_ROW],
  markets = [COLOMBIA_ROW],
  writeRejection,
  isWriteIgnored = false,
  ...options
}: FakeMarketsOptions = {}): FakeMarketsApi {
  const supabase = stubSupabase(options);
  const fallback = globalThis.fetch;
  const tableWrites: FakeTableWrite[] = [];
  const tables: Readonly<Record<string, readonly object[]>> = {
    "/rest/v1/languages": languages,
    "/rest/v1/markets": markets,
  };

  async function answerWrite(
    request: Request,
    rows: readonly object[],
  ): Promise<Response> {
    const url = new URL(request.url);
    tableWrites.push({
      path: `${url.pathname}${url.search}`,
      body: await request.json(),
      authorization: request.headers.get("authorization"),
    });
    if (writeRejection !== undefined) {
      return Response.json(
        { code: CHECK_VIOLATION, message: writeRejection },
        { status: 400 },
      );
    }
    return Response.json(isWriteIgnored ? [] : filterRows(rows, url));
  }

  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const rows = tables[url.pathname];
      if (rows === undefined) return fallback(request);
      return request.method === "GET"
        ? Response.json(filterRows(rows, url))
        : answerWrite(request, rows);
    },
  );
  return Object.assign(supabase, { tableWrites });
}
