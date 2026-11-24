import { describe, expect, it, vi } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { getCurrentLegalVersion } from "../legal/legal-documents";
import type { WaitlistEntry } from "../waitlists.server";

import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "./field-names";
import type { FormStore } from "./form-store.server";
import { issueFormProtection } from "./protected-form.server";
import { TURNSTILE_TEST_KEYS } from "./turnstile-test-keys";
import { TURNSTILE_FIELD } from "./turnstile.server";
import {
  WAITLIST_FORM,
  handleWaitlistSubmission,
  type WaitlistSubmissionDependencies,
} from "./waitlist-form.server";

const RENDERED_AT = Date.UTC(2026, 10, 20, 15, 0, 0);
const SECOND_MS = 1000;
const HUMAN_DELAY_MS = 4 * SECOND_MS;
const BOT_DELAY_MS = 2 * SECOND_MS;
const ENV = buildTestServerEnv();
const MAX_ATTEMPTS = 5;

interface Harness {
  readonly joined: WaitlistEntry[];
  readonly dependencies: WaitlistSubmissionDependencies & {
    readonly protection: NonNullable<
      WaitlistSubmissionDependencies["protection"]
    >;
  };
}

function createHarness(): Harness {
  const counts = new Map<string, number>();
  const store: FormStore = {
    checkRateLimit: ({ key, maxAttempts }) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return Promise.resolve(count <= maxAttempts);
    },
    recordRejection: () => Promise.resolve(),
  };
  const joined: WaitlistEntry[] = [];
  return {
    joined,
    dependencies: {
      protection: {
        env: ENV,
        now: () => RENDERED_AT + HUMAN_DELAY_MS,
        fetch: () => {
          throw new Error("Esta prueba no debía llamar a Cloudflare");
        },
        store,
      },
      join: (entry) => {
        joined.push(entry);
        return Promise.resolve();
      },
    },
  };
}

function buildRequest(
  fields: Record<string, string>,
  { path = "/app", withToken = true } = {},
): Request {
  const { timestamp } = issueFormProtection(WAITLIST_FORM, {
    env: ENV,
    now: () => RENDERED_AT,
  });
  const body = new FormData();
  const all: Record<string, string> = {
    email: "ana@ejemplo.co",
    country: "CO",
    [TIMESTAMP_FIELD]: timestamp,
    ...(withToken ? { [TURNSTILE_FIELD]: TURNSTILE_TEST_KEYS.dummyToken } : {}),
    ...fields,
  };
  for (const [name, value] of Object.entries(all)) body.set(name, value);
  return new Request(`https://volleytip.test${path}`, {
    method: "POST",
    headers: { "X-Forwarded-For": "203.0.113.7" },
    body,
  });
}

describe("app: action", () => {
  it("un envío válido inscribe con tipo app, idioma, país y versión", async () => {
    const { joined, dependencies } = createHarness();
    const request = buildRequest({ email: " Ana@Ejemplo.co ", country: "MX" });

    const response = await handleWaitlistSubmission(
      request,
      "app",
      dependencies,
    );

    expect(response.init?.status).toBe(200);
    expect(response.data).toEqual({ status: "joined" });
    expect(joined).toEqual([
      {
        kind: "app",
        email: "Ana@Ejemplo.co",
        locale: "es",
        countryCode: "MX",
        city: null,
        privacyVersion: getCurrentLegalVersion("privacy"),
      },
    ]);
  });

  it("toma el idioma de la página", async () => {
    const { joined, dependencies } = createHarness();

    await handleWaitlistSubmission(
      buildRequest({}, { path: "/en/app" }),
      "app",
      dependencies,
    );

    expect(joined[0]?.locale).toBe("en");
  });

  it("un correo repetido recibe la misma confirmación", async () => {
    const { dependencies } = createHarness();

    const first = await handleWaitlistSubmission(
      buildRequest({}),
      "app",
      dependencies,
    );
    const second = await handleWaitlistSubmission(
      buildRequest({}),
      "app",
      dependencies,
    );

    expect(second).toEqual(first);
  });

  it("un correo inválido responde 400 con el error en el campo y lo escrito", async () => {
    const { joined, dependencies } = createHarness();

    const response = await handleWaitlistSubmission(
      buildRequest({ email: "no-es-correo", country: "MX" }),
      "app",
      dependencies,
    );

    expect(response.init?.status).toBe(400);
    expect(response.data).toMatchObject({
      status: "invalid",
      fieldErrors: { email: expect.any(String) },
      values: { email: "no-es-correo", country: "MX" },
    });
    expect(joined).toEqual([]);
  });

  it("un país que no está en la lista responde 400", async () => {
    const { joined, dependencies } = createHarness();

    const response = await handleWaitlistSubmission(
      buildRequest({ country: "ZZ" }),
      "app",
      dependencies,
    );

    expect(response.init?.status).toBe(400);
    expect(response.data).toMatchObject({
      status: "invalid",
      fieldErrors: { country: expect.any(String) },
    });
    expect(joined).toEqual([]);
  });
});

describe("app: protección", () => {
  it("sin verificación de Turnstile no inscribe", async () => {
    const { joined, dependencies } = createHarness();
    const failingFetch = (): Promise<Response> =>
      Promise.resolve(Response.json({ success: false }));
    const stagingEnv = buildTestServerEnv({
      appEnv: "staging",
      turnstileSecretKey: "0x4AAAAAAA-llave-secreta-de-mentira",
    });

    const response = await handleWaitlistSubmission(
      buildRequest({}, { withToken: false }),
      "app",
      {
        ...dependencies,
        protection: {
          ...dependencies.protection,
          env: stagingEnv,
          fetch: failingFetch,
        },
      },
    );

    expect(response.init?.status).toBe(400);
    expect(response.data).toEqual({
      status: "rejected",
      reason: "verification_failed",
    });
    expect(joined).toEqual([]);
  });

  it("con el campo trampa lleno no inscribe y responde como un éxito", async () => {
    const { joined, dependencies } = createHarness();

    const response = await handleWaitlistSubmission(
      buildRequest({ [HONEYPOT_FIELD]: "soy un bot" }),
      "app",
      dependencies,
    );

    expect(response.data).toEqual({ status: "joined" });
    expect(joined).toEqual([]);
  });

  it("hecho en menos de 3 segundos no inscribe", async () => {
    const { joined, dependencies } = createHarness();

    const response = await handleWaitlistSubmission(buildRequest({}), "app", {
      ...dependencies,
      protection: {
        ...dependencies.protection,
        now: () => RENDERED_AT + BOT_DELAY_MS,
      },
    });

    expect(response.data).toEqual({ status: "rejected", reason: "too_fast" });
    expect(joined).toEqual([]);
  });

  it("el sexto envío en 10 minutos desde la misma IP no inscribe", async () => {
    const { joined, dependencies } = createHarness();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await handleWaitlistSubmission(buildRequest({}), "app", dependencies);
    }
    const sixth = await handleWaitlistSubmission(
      buildRequest({}),
      "app",
      dependencies,
    );

    expect(sixth.init?.status).toBe(429);
    expect(sixth.data).toEqual({ status: "rejected", reason: "rate_limited" });
    expect(joined).toHaveLength(MAX_ATTEMPTS);
  });

  it("si la base falla, lanza el error en vez de confirmar", async () => {
    const { dependencies } = createHarness();
    const join = vi.fn().mockRejectedValue(new Error("base caída"));

    await expect(
      handleWaitlistSubmission(buildRequest({}), "app", {
        ...dependencies,
        join,
      }),
    ).rejects.toThrow("base caída");
  });
});
