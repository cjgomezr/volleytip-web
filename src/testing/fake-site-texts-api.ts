import { vi } from "vitest";

import {
  stubSupabase,
  type FakeSupabase,
  type FakeSupabaseOptions,
} from "./fake-supabase";

export interface FakeTextRow {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
}

export interface FakeSiteTextsOptions extends FakeSupabaseOptions {
  /** El valor de `settings.announcement_bar`; sin él, la fila no existe. */
  readonly announcementBar?: unknown;
  readonly siteTexts?: readonly FakeTextRow[];
}

export interface FakeSiteTextsApi extends FakeSupabase {
  /** El cuerpo de cada escritura pedida a `site_texts`. */
  readonly siteTextWrites: unknown[];
  /** La cabecera `Authorization` de cada una de esas escrituras. */
  readonly siteTextAuthorizations: (string | null)[];
}

/** La tabla `site_texts` de mentira, encima de `stubSupabase`, que ya
 * contesta por `settings`. */
export function stubSiteTextsApi({
  announcementBar,
  siteTexts = [],
  ...options
}: FakeSiteTextsOptions = {}): FakeSiteTextsApi {
  const supabase = stubSupabase({
    ...options,
    settings:
      announcementBar === undefined
        ? {}
        : { announcement_bar: announcementBar },
  });
  const fallback = globalThis.fetch;
  const siteTextWrites: unknown[] = [];
  const siteTextAuthorizations: (string | null)[] = [];

  async function answerSiteTexts(request: Request): Promise<Response> {
    if (request.method === "GET") return Response.json(siteTexts);
    siteTextWrites.push(await request.json());
    siteTextAuthorizations.push(request.headers.get("authorization"));
    return new Response(null, { status: 201 });
  }

  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      return pathname === "/rest/v1/site_texts"
        ? answerSiteTexts(request)
        : fallback(request);
    },
  );
  return Object.assign(supabase, { siteTextWrites, siteTextAuthorizations });
}
