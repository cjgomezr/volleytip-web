import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerEnv } from "../env.server";
import { createAnonSupabaseClient } from "./anon-client.server";
import { createServiceSupabaseClient } from "./service-client.server";

const FAKE_ENV: ServerEnv = {
  appEnv: "test",
  supabaseUrl: "https://proyecto-de-prueba.supabase.test",
  supabaseAnonKey: "llave-publica-falsa",
  supabaseServiceRoleKey: "llave-de-servicio-falsa",
};
// El SUPABASE_URL con el que corren las pruebas (tests/support/test-env.ts).
const TEST_RUN_SUPABASE_HOST = "127.0.0.1:54321";

interface CapturedRequest {
  readonly url: string;
  readonly apiKey: string | null;
  readonly authorization: string | null;
}

/** Sustituye `fetch` y devuelve las peticiones que el cliente intente hacer. */
function captureRequests(): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      captured.push({
        url: request.url,
        apiKey: request.headers.get("apikey"),
        authorization: request.headers.get("authorization"),
      });
      return Promise.resolve(Response.json([]));
    },
  );
  return captured;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clientes de Supabase", () => {
  it("el cliente público habla con el proyecto usando la llave pública", async () => {
    const requests = captureRequests();

    await createAnonSupabaseClient(FAKE_ENV).from("ejemplo").select();

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain(FAKE_ENV.supabaseUrl);
    expect(requests[0]?.apiKey).toBe(FAKE_ENV.supabaseAnonKey);
    expect(requests[0]?.authorization).toBe(
      `Bearer ${FAKE_ENV.supabaseAnonKey}`,
    );
  });

  it("el cliente de servicio habla con el proyecto usando la llave de servicio", async () => {
    const requests = captureRequests();

    await createServiceSupabaseClient(FAKE_ENV).from("ejemplo").select();

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain(FAKE_ENV.supabaseUrl);
    expect(requests[0]?.apiKey).toBe(FAKE_ENV.supabaseServiceRoleKey);
    expect(requests[0]?.authorization).toBe(
      `Bearer ${FAKE_ENV.supabaseServiceRoleKey}`,
    );
  });

  it("el cliente público nunca envía la llave de servicio", async () => {
    const requests = captureRequests();

    await createAnonSupabaseClient(FAKE_ENV).from("ejemplo").select();

    expect(JSON.stringify(requests)).not.toContain(
      FAKE_ENV.supabaseServiceRoleKey,
    );
  });

  it("sin argumentos usan el entorno validado del servidor", async () => {
    const requests = captureRequests();

    await createAnonSupabaseClient().from("ejemplo").select();

    expect(requests[0]?.url).toContain(TEST_RUN_SUPABASE_HOST);
  });

  it("cada llamada crea un cliente nuevo, sin estado compartido entre peticiones", () => {
    expect(createAnonSupabaseClient(FAKE_ENV)).not.toBe(
      createAnonSupabaseClient(FAKE_ENV),
    );
  });
});
