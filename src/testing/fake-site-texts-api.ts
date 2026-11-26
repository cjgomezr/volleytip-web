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
  /** El cuerpo de cada escritura pedida a cada tabla. */
  readonly settingsWrites: unknown[];
  readonly siteTextWrites: unknown[];
  /** La cabecera `Authorization` de cada escritura. */
  readonly writeAuthorizations: (string | null)[];
}

/** Las tablas `settings` y `site_texts` de mentira, encima de
 * `stubSupabase`: anota lo que se les escribe. */
export function stubSiteTextsApi(
  options: FakeSiteTextsOptions = {},
): FakeSiteTextsApi {
  const supabase = stubSupabase(options);
  const fallback = globalThis.fetch;
  const settingsWrites: unknown[] = [];
  const siteTextWrites: unknown[] = [];
  const writeAuthorizations: (string | null)[] = [];

  async function recordWrite(
    request: Request,
    writes: unknown[],
  ): Promise<Response> {
    writes.push(await request.json());
    writeAuthorizations.push(request.headers.get("authorization"));
    return new Response(null, { status: 201 });
  }

  function readSettingRows(): Response {
    const value = options.announcementBar;
    return Response.json(value === undefined ? [] : [{ value }]);
  }

  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      const isRead = request.method === "GET";
      if (pathname === "/rest/v1/settings") {
        return isRead
          ? readSettingRows()
          : recordWrite(request, settingsWrites);
      }
      if (pathname === "/rest/v1/site_texts") {
        return isRead
          ? Response.json(options.siteTexts ?? [])
          : recordWrite(request, siteTextWrites);
      }
      return fallback(request);
    },
  );
  return Object.assign(supabase, {
    settingsWrites,
    siteTextWrites,
    writeAuthorizations,
  });
}
