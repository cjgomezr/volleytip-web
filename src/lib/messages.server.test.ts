import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { saveMessage, type MessageEntry } from "./messages.server";
import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

const DATABASE_ERROR_STATUS = 500;
const NO_CONTENT_STATUS = 204;
const ENTRY: MessageEntry = {
  reason: "camps",
  name: "Ana",
  email: "ana@example.com",
  whatsapp: "+573001234567",
  countryCode: "CO",
  body: "Quiero saber del próximo camp.",
  payload: { participants: 2 },
  locale: "es",
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

describe("guardar un mensaje: función del servidor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("llama a la función save_message con los campos del mensaje", async () => {
    const { client, readBody, readUrl } = createClientRecordingRequests();

    await saveMessage(ENTRY, client);

    expect(readUrl()).toContain("/rpc/save_message");
    expect(await readBody()).toEqual({
      p_reason: "camps",
      p_name: "Ana",
      p_email: "ana@example.com",
      p_whatsapp: "+573001234567",
      p_country_code: "CO",
      p_body: "Quiero saber del próximo camp.",
      p_payload: { participants: 2 },
      p_locale: "es",
      p_privacy_version: "2026-11",
    });
  });

  it("omite el WhatsApp y el país cuando son nulos", async () => {
    const { client, readBody } = createClientRecordingRequests();

    await saveMessage({ ...ENTRY, whatsapp: null, countryCode: null }, client);

    const body = await readBody();
    expect(body).not.toHaveProperty("p_whatsapp");
    expect(body).not.toHaveProperty("p_country_code");
  });

  it("propaga el fallo de la base con el motivo en el mensaje", async () => {
    const client = createClientAnswering(
      Response.json(
        { code: "XX000", message: "la base no responde" },
        { status: DATABASE_ERROR_STATUS },
      ),
    );

    await expect(saveMessage(ENTRY, client)).rejects.toThrow(
      /camps.*la base no responde/,
    );
  });
});
