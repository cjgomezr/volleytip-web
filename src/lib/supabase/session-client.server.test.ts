import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSessionCookie,
  RENEWED_ACCESS_TOKEN,
  stubSupabase,
} from "~/testing/fake-supabase";
import { buildTestServerEnv } from "~/testing/test-server-env";

import type { AppEnvironment } from "../env.server";
import {
  createSessionSupabaseClient,
  type SessionSupabase,
} from "./session-client.server";

const ENV = buildTestServerEnv();

function buildRequest(cookie: string): Request {
  return new Request("http://localhost/admin", {
    headers: { Cookie: cookie },
  });
}

function readSetCookies(session: SessionSupabase): string[] {
  const headers = new Headers();
  session.writeCookies(headers);
  return headers.getSetCookie();
}

async function renewExpiredSession(appEnv: AppEnvironment): Promise<string[]> {
  const env = buildTestServerEnv({ appEnv });
  const session = createSessionSupabaseClient(
    buildRequest(buildSessionCookie(env.supabaseUrl, { isExpired: true })),
    env,
  );
  await session.client.auth.getUser();
  return readSetCookies(session);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sesión del admin", () => {
  it("verifica el usuario contra Supabase, no solo la cookie", async () => {
    const supabase = stubSupabase();
    const session = createSessionSupabaseClient(
      buildRequest(buildSessionCookie(ENV.supabaseUrl)),
      ENV,
    );

    const { data } = await session.client.auth.getUser();

    expect(data.user).not.toBeNull();
    expect(supabase.requests).toContain("GET /auth/v1/user");
  });

  it("no acepta una cookie con un token que Supabase rechaza", async () => {
    stubSupabase();
    const forged = buildSessionCookie(ENV.supabaseUrl, {
      accessToken: "token-inventado",
    });
    const session = createSessionSupabaseClient(buildRequest(forged), ENV);

    const { data } = await session.client.auth.getUser();

    expect(data.user).toBeNull();
  });

  it("renueva un token vencido y entrega las cookies nuevas", async () => {
    const supabase = stubSupabase();

    const [cookie = ""] = await renewExpiredSession("test");

    expect(supabase.requests).toContain(
      "POST /auth/v1/token?grant_type=refresh_token",
    );
    const [, encoded = ""] = /=base64-([^;]+)/.exec(cookie) ?? [];
    expect(Buffer.from(encoded, "base64url").toString()).toContain(
      RENEWED_ACCESS_TOKEN,
    );
  });

  it("no toca las cookies cuando la sesión sigue vigente", async () => {
    stubSupabase();
    const session = createSessionSupabaseClient(
      buildRequest(buildSessionCookie(ENV.supabaseUrl)),
      ENV,
    );

    await session.client.auth.getUser();

    expect(readSetCookies(session)).toEqual([]);
  });

  it.each(["local", "test"] as const)(
    "en %s las cookies son HttpOnly y SameSite=Lax, sin Secure",
    async (appEnv) => {
      stubSupabase();

      const cookies = await renewExpiredSession(appEnv);

      expect(cookies.length).toBeGreaterThan(0);
      for (const cookie of cookies) {
        expect(cookie).toMatch(/; HttpOnly/i);
        expect(cookie).toMatch(/; SameSite=Lax/i);
        expect(cookie).toMatch(/; Path=\//i);
        expect(cookie).not.toMatch(/; Secure/i);
      }
    },
  );

  it.each(["staging", "production"] as const)(
    "en %s las cookies además son Secure",
    async (appEnv) => {
      stubSupabase();

      const cookies = await renewExpiredSession(appEnv);

      expect(cookies.length).toBeGreaterThan(0);
      for (const cookie of cookies) {
        expect(cookie).toMatch(/; HttpOnly/i);
        expect(cookie).toMatch(/; SameSite=Lax/i);
        expect(cookie).toMatch(/; Secure/i);
      }
    },
  );

  it("cerrar sesión la invalida en Supabase y borra las cookies", async () => {
    const supabase = stubSupabase();
    const session = createSessionSupabaseClient(
      buildRequest(buildSessionCookie(ENV.supabaseUrl)),
      ENV,
    );

    const { error } = await session.client.auth.signOut({ scope: "local" });

    expect(error).toBeNull();
    expect(supabase.requests).toContain("POST /auth/v1/logout?scope=local");
    const cookies = readSetCookies(session);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/-auth-token=;.*Max-Age=0/i);
  });

  it("renovar y cerrar en la misma petición deja la cookie borrada", async () => {
    stubSupabase();
    const session = createSessionSupabaseClient(
      buildRequest(buildSessionCookie(ENV.supabaseUrl, { isExpired: true })),
      ENV,
    );

    await session.client.auth.getUser();
    await session.client.auth.signOut({ scope: "local" });

    const cookies = readSetCookies(session);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/Max-Age=0/i);
  });
});
