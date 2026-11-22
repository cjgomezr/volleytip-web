import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";
import { joinWaitlist, type WaitlistEntry } from "./waitlists.server";

const DATABASE_ERROR_STATUS = 500;
const NO_CONTENT_STATUS = 204;
const ENTRY: WaitlistEntry = {
  kind: "app",
  email: "ana@example.com",
  locale: "es",
  countryCode: "CO",
  city: "Medellín",
  privacyVersion: "2026-11",
};

function createClientAnswering(response: Response): TypedSupabaseClient {
  vi.stubGlobal("fetch", (): Promise<Response> => Promise.resolve(response));
  return createServiceSupabaseClient(buildTestServerEnv());
}

function createClientRecordingRequests(): {
  readonly client: TypedSupabaseClient;
  readonly readBody: () => Promise<unknown>;
  readonly readUrl: () => string;
} {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requests.push(new Request(input, init));
      return Promise.resolve(new Response(null, { status: NO_CONTENT_STATUS }));
    },
  );
  return {
    client: createServiceSupabaseClient(buildTestServerEnv()),
    readBody: () => {
      const [request] = requests;
      if (request === undefined) {
        throw new Error("No salió ninguna petición");
      }
      return request.json();
    },
    readUrl: () => requests[0]?.url ?? "",
  };
}

describe("inscribir en una lista: función del servidor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve lo mismo cuando la base inscribe y cuando el correo ya estaba", async () => {
    // La función de Postgres responde igual en los dos casos; aquí se
    // comprueba que la capa de servidor no añade nada que los distinga.
    const first = await joinWaitlist(
      ENTRY,
      createClientAnswering(new Response(null, { status: NO_CONTENT_STATUS })),
    );
    const repeated = await joinWaitlist(
      ENTRY,
      createClientAnswering(new Response(null, { status: NO_CONTENT_STATUS })),
    );

    expect(first).toBeUndefined();
    expect(repeated).toBe(first);
  });

  it("llama a la función enroll_waitlist con la entrada", async () => {
    const { client, readBody, readUrl } = createClientRecordingRequests();

    await joinWaitlist(ENTRY, client);

    expect(readUrl()).toContain("/rpc/enroll_waitlist");
    expect(await readBody()).toEqual({
      p_kind: "app",
      p_email: "ana@example.com",
      p_locale: "es",
      p_country_code: "CO",
      p_city: "Medellín",
      p_privacy_version: "2026-11",
    });
  });

  it("propaga el fallo de la base con el tipo de lista en el mensaje", async () => {
    const client = createClientAnswering(
      Response.json(
        { code: "XX000", message: "la base no responde" },
        { status: DATABASE_ERROR_STATUS },
      ),
    );

    await expect(joinWaitlist(ENTRY, client)).rejects.toThrow(
      /app.*la base no responde/,
    );
  });
});
