import { vi } from "vitest";

import {
  stubSupabase,
  type FakeSupabase,
  type FakeSupabaseOptions,
} from "./fake-supabase";

export interface FakeFaqRow {
  readonly id: string;
  readonly status: "draft" | "published" | "retired";
  readonly faq_translations: readonly {
    readonly locale: string;
    readonly question: string;
    readonly answer: string;
  }[];
}

export interface FakeRpcFailure {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

export interface FakeLanguageRow {
  readonly code: string;
  readonly name: string;
  readonly is_default: boolean;
  readonly is_active: boolean;
}

export interface FakeFaqsOptions extends FakeSupabaseOptions {
  /** Las preguntas, ya en el orden en que la base las devolvería. */
  readonly faqs?: readonly FakeFaqRow[];
  /** Las filas de `languages`. Por defecto los dos idiomas, activos. */
  readonly languages?: readonly FakeLanguageRow[];
  /** Lo que contesta cada función de la base, por su nombre. */
  readonly rpcResults?: Readonly<Record<string, unknown>>;
  /** Hace fallar toda llamada a una función de la base. */
  readonly rpcFailure?: FakeRpcFailure;
}

export interface FakeRpcCall {
  readonly name: string;
  readonly body: unknown;
  readonly authorization: string | null;
}

export interface FakeFaqsApi extends FakeSupabase {
  readonly rpcCalls: FakeRpcCall[];
  /** La dirección de cada lectura de `faqs`. */
  readonly faqReads: string[];
}

export const BOTH_LANGUAGES = [
  { code: "es", name: "Español", is_default: true, is_active: true },
  { code: "en", name: "English", is_default: false, is_active: true },
] as const satisfies readonly FakeLanguageRow[];

const RPC_PREFIX = "/rest/v1/rpc/";

/** Las tablas de las preguntas y sus funciones, de mentira, encima de
 * `stubSupabase`. Lo que la base hace de verdad se prueba en
 * `src/db/panel-faqs.integration.test.ts`. */
export function stubFaqsApi({
  faqs = [],
  languages = BOTH_LANGUAGES,
  rpcResults = {},
  rpcFailure,
  ...options
}: FakeFaqsOptions = {}): FakeFaqsApi {
  const supabase = stubSupabase(options);
  const fallback = globalThis.fetch;
  const rpcCalls: FakeRpcCall[] = [];
  const faqReads: string[] = [];

  async function answerRpc(request: Request, name: string): Promise<Response> {
    rpcCalls.push({
      name,
      body: await request.json(),
      authorization: request.headers.get("authorization"),
    });
    if (rpcFailure) {
      const { status, ...error } = rpcFailure;
      return Response.json(error, { status });
    }
    return Response.json(rpcResults[name] ?? null);
  }

  function answerFaqs(url: URL): Response {
    faqReads.push(url.search);
    const id = url.searchParams.get("id")?.replace("eq.", "");
    return Response.json(
      id === undefined ? faqs : faqs.filter((faq) => faq.id === id),
    );
  }

  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.pathname.startsWith(RPC_PREFIX)) {
        return answerRpc(request, url.pathname.slice(RPC_PREFIX.length));
      }
      if (url.pathname === "/rest/v1/faqs") return answerFaqs(url);
      if (url.pathname === "/rest/v1/languages") {
        return Response.json(languages);
      }
      return fallback(request);
    },
  );
  return Object.assign(supabase, { rpcCalls, faqReads });
}
