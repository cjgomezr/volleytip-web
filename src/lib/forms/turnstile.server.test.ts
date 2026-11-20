import { afterEach, describe, expect, it, vi } from "vitest";

import { TEST_ENV } from "../../../tests/support/test-env";

import {
  TURNSTILE_TEST_KEYS,
  TURNSTILE_VERIFY_URL,
  verifyTurnstile,
} from "./turnstile.server";

const REAL_SECRET = "0x4AAAAAAA-secreto-real-de-mentira";
const REAL_TOKEN = "0.token-que-entrega-el-widget";
const TIMEOUT_MS = 5000;
const MAX_TOKEN_LENGTH = 2048;

type FetchLike = typeof fetch;

function respondWithJson(body: unknown, status = 200): FetchLike {
  return vi.fn<FetchLike>(() =>
    Promise.resolve(Response.json(body, { status })),
  );
}

function respondWithText(text: string, status = 200): FetchLike {
  return vi.fn<FetchLike>(() =>
    Promise.resolve(new Response(text, { status })),
  );
}

/** Un `fetch` que nunca responde y solo termina cuando lo cancelan. */
function neverRespond(): FetchLike {
  return vi.fn<FetchLike>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Cancelado", "AbortError"));
        });
      }),
  );
}

function verifyInStaging(
  token: string | null | undefined,
  fetchImplementation: FetchLike,
): Promise<boolean> {
  return verifyTurnstile(token, {
    secretKey: REAL_SECRET,
    appEnv: "staging",
    fetch: fetchImplementation,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("verificación de Turnstile", () => {
  it("un token que Cloudflare acepta pasa", async () => {
    const fetchSpy = respondWithJson({
      success: true,
      challenge_ts: "2026-11-20T15:00:00.000Z",
      hostname: "staging.volleytip.com",
      "error-codes": [],
    });

    expect(await verifyInStaging(REAL_TOKEN, fetchSpy)).toBe(true);
  });

  it("le envía a Cloudflare el secreto y el token, y nada más", async () => {
    const fetchSpy = vi.fn<FetchLike>(() =>
      Promise.resolve(Response.json({ success: true })),
    );

    await verifyInStaging(REAL_TOKEN, fetchSpy);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init?.method).toBe("POST");
    const sent = new URLSearchParams(String(init?.body));
    expect([...sent.keys()].sort()).toEqual(["response", "secret"]);
    expect(sent.get("secret")).toBe(REAL_SECRET);
    expect(sent.get("response")).toBe(REAL_TOKEN);
  });

  it("un token que Cloudflare rechaza falla", async () => {
    const fetchSpy = respondWithJson({
      success: false,
      "error-codes": ["invalid-input-response"],
    });

    expect(await verifyInStaging(REAL_TOKEN, fetchSpy)).toBe(false);
  });

  it.each([
    ["ausente", undefined],
    ["nulo", null],
    ["vacío", ""],
    ["solo espacios", "   "],
  ])("con el token %s falla sin llamar a Cloudflare", async (_case, token) => {
    const fetchSpy = respondWithJson({ success: true });

    expect(await verifyInStaging(token, fetchSpy)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("un token más largo que el máximo falla sin llamar a Cloudflare", async () => {
    const fetchSpy = respondWithJson({ success: true });
    const tooLong = "a".repeat(MAX_TOKEN_LENGTH + 1);

    expect(await verifyInStaging(tooLong, fetchSpy)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("un archivo en vez de token falla", async () => {
    const fetchSpy = respondWithJson({ success: true });
    const file = new File(["x"], "x.txt");

    const passed = await verifyTurnstile(file, {
      secretKey: REAL_SECRET,
      appEnv: "staging",
      fetch: fetchSpy,
    });

    expect(passed).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("si Cloudflare no responde en 5 segundos, falla", async () => {
    vi.useFakeTimers();
    const fetchSpy = neverRespond();
    let settled: boolean | undefined;

    const pending = verifyInStaging(REAL_TOKEN, fetchSpy).then((passed) => {
      settled = passed;
    });
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(settled).toBe(false);
  });

  it("con un error HTTP falla, aunque el cuerpo diga que pasó", async () => {
    const fetchSpy = respondWithJson({ success: true }, 500);

    expect(await verifyInStaging(REAL_TOKEN, fetchSpy)).toBe(false);
  });

  it("con un cuerpo que no es JSON falla", async () => {
    const fetchSpy = respondWithText("<html>502 Bad Gateway</html>");

    expect(await verifyInStaging(REAL_TOKEN, fetchSpy)).toBe(false);
  });

  it.each([
    ["sin el campo success", {}],
    ["con success como texto", { success: "true" }],
    ["con success como número", { success: 1 }],
    ["que es null", null],
    ["que es una lista", [true]],
  ])("con un cuerpo %s falla", async (_case, body) => {
    const fetchSpy = respondWithJson(body);

    expect(await verifyInStaging(REAL_TOKEN, fetchSpy)).toBe(false);
  });

  it("si la red falla, falla", async () => {
    const fetchSpy = vi.fn<FetchLike>(() =>
      Promise.reject(new TypeError("fetch failed")),
    );

    expect(await verifyInStaging(REAL_TOKEN, fetchSpy)).toBe(false);
  });

  it("en production también pregunta a Cloudflare", async () => {
    const fetchSpy = respondWithJson({ success: true });

    const passed = await verifyTurnstile(REAL_TOKEN, {
      secretKey: REAL_SECRET,
      appEnv: "production",
      fetch: fetchSpy,
    });

    expect(passed).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("llaves de prueba", () => {
  it.each(["local", "test"] as const)(
    "en %s el token ficticio pasa sin ninguna llamada a la red",
    async (appEnv) => {
      const fetchSpy = respondWithJson({ success: false });

      const passed = await verifyTurnstile(TURNSTILE_TEST_KEYS.dummyToken, {
        secretKey: TURNSTILE_TEST_KEYS.passingSecretKey,
        appEnv,
        fetch: fetchSpy,
      });

      expect(passed).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each(["local", "test"] as const)(
    "en %s otro token falla sin ninguna llamada a la red",
    async (appEnv) => {
      const fetchSpy = respondWithJson({ success: true });

      const passed = await verifyTurnstile(REAL_TOKEN, {
        secretKey: TURNSTILE_TEST_KEYS.passingSecretKey,
        appEnv,
        fetch: fetchSpy,
      });

      expect(passed).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each(["local", "test"] as const)(
    "en %s el secreto que siempre falla rechaza el token ficticio",
    async (appEnv) => {
      const fetchSpy = respondWithJson({ success: true });

      const passed = await verifyTurnstile(TURNSTILE_TEST_KEYS.dummyToken, {
        secretKey: TURNSTILE_TEST_KEYS.failingSecretKey,
        appEnv,
        fetch: fetchSpy,
      });

      expect(passed).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("en local, sin token, falla", async () => {
    const passed = await verifyTurnstile(undefined, {
      secretKey: TURNSTILE_TEST_KEYS.passingSecretKey,
      appEnv: "local",
    });

    expect(passed).toBe(false);
  });

  it("el entorno de las pruebas usa las llaves de prueba de Cloudflare", () => {
    expect(TEST_ENV.TURNSTILE_SITE_KEY).toBe(TURNSTILE_TEST_KEYS.siteKey);
    expect(TEST_ENV.TURNSTILE_SECRET_KEY).toBe(
      TURNSTILE_TEST_KEYS.passingSecretKey,
    );
  });
});
