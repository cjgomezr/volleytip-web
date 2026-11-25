import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import { ADMIN_PROFILE, stubSupabase } from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import { action, loader } from "./sign-in-link";

const TOKEN = "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4";
const LINK = `/admin/entrar/enlace?token_hash=${TOKEN}`;

interface Run {
  readonly result: unknown;
  /** Las cookies que la respuesta pondría en el navegador. */
  readonly cookies: string[];
}

async function runRedeem(
  path: string,
  fields: Readonly<Record<string, string>> = { token_hash: TOKEN },
): Promise<Run> {
  const request = new Request(`http://localhost${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  const session = createSessionSupabaseClient(request);
  const context = new RouterContextProvider();
  context.set(panelSessionContext, session);
  const result: unknown = await action({
    request,
    context,
    params: {},
  } as unknown as Parameters<typeof action>[0]).catch(
    (error: unknown) => error,
  );
  const headers = new Headers();
  session.writeCookies(headers);
  return { result, cookies: headers.getSetCookie() };
}

function openLink(path: string): ReturnType<typeof loader> {
  return loader({
    request: new Request(`http://localhost${path}`),
    context: new RouterContextProvider(),
    params: {},
  } as unknown as Parameters<typeof loader>[0]);
}

function readDestination(result: unknown): string | null {
  expect(result).toBeInstanceOf(Response);
  return (result as Response).headers.get("Location");
}

function hasLiveSession(cookies: readonly string[]): boolean {
  const last = cookies
    .filter((cookie) => cookie.includes("-auth-token"))
    .at(-1);
  return last !== undefined && !last.includes("Max-Age=0");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("entrada: canje", () => {
  it("cargar la página no canjea ni llama a Supabase", () => {
    const supabase = stubSupabase();

    const data = openLink(LINK);

    expect(data).toEqual({
      tokenHash: TOKEN,
      returnPath: null,
      signInPath: "/admin/entrar",
    });
    expect(supabase.requests).toEqual([]);
  });

  it.each(["", "?token_hash=", "?token_hash=corto", "?token_hash=a%20b%3Cc"])(
    "un enlace %j se muestra como inservible",
    (query) => {
      expect(openLink(`/admin/entrar/enlace${query}`)).toMatchObject({
        tokenHash: null,
      });
    },
  );

  it("el enlace de pedir otro conserva la página pedida", () => {
    const next = encodeURIComponent(`${TEST_ENV.SITE_ORIGIN}/admin/mensajes`);

    expect(openLink(`${LINK}&next=${next}`)).toMatchObject({
      returnPath: "/admin/mensajes",
      signInPath: "/admin/entrar?next=%2Fadmin%2Fmensajes",
    });
  });

  // Sin página pedida, Supabase escribe en el correo la dirección del sitio.
  it("sin una página concreta no arrastra ninguna dirección", () => {
    const next = encodeURIComponent(TEST_ENV.SITE_ORIGIN);

    expect(openLink(`${LINK}&next=${next}`)).toMatchObject({
      returnPath: null,
      signInPath: "/admin/entrar",
    });
  });

  it("enviar el botón canjea el token y crea la sesión", async () => {
    const supabase = stubSupabase();

    const { result, cookies } = await runRedeem(LINK);

    expect(supabase.verifications).toEqual([
      expect.objectContaining({ token_hash: TOKEN, type: "email" }),
    ]);
    expect(readDestination(result)).toBe("/admin");
    expect(hasLiveSession(cookies)).toBe(true);
    expect(cookies.join()).toContain("HttpOnly");
  });

  it.each([
    ["es", "/en/admin/sign-in/link", "/admin"],
    ["en", "/admin/entrar/enlace", "/en/admin"],
  ])(
    "llega al panel en el idioma del perfil (%s) desde %s",
    async (profileLocale, path, destination) => {
      stubSupabase({ profileLocale });

      const { result } = await runRedeem(`${path}?token_hash=${TOKEN}`);

      expect(readDestination(result)).toBe(destination);
    },
  );

  it.each([
    [`${TEST_ENV.SITE_ORIGIN}/admin/mensajes?page=2`, "/admin/mensajes?page=2"],
    ["/admin/mensajes", "/admin/mensajes"],
    [`${TEST_ENV.SITE_ORIGIN}/admin`, "/en/admin"],
    [TEST_ENV.SITE_ORIGIN, "/en/admin"],
    ["https://sitio-ajeno.test/contacto", "/en/admin"],
    ["javascript:alert(1)", "/en/admin"],
    ["//sitio-ajeno.test", "/en/admin"],
  ])("con next=%s lleva a %s", async (next, destination) => {
    stubSupabase({ profileLocale: "en" });

    const { result } = await runRedeem(LINK, { token_hash: TOKEN, next });

    expect(readDestination(result)).toBe(destination);
  });

  it.each([400, 401, 403, 404, 422])(
    "un enlace vencido, usado o alterado (%i) muestra el aviso sin sesión",
    async (verifyFailureStatus) => {
      stubSupabase({ verifyFailureStatus });

      const { result, cookies } = await runRedeem(LINK);

      expect(result).toMatchObject({
        data: { status: "invalid_link" },
        init: { status: 400 },
      });
      expect(hasLiveSession(cookies)).toBe(false);
    },
  );

  it("sin token no llama a Supabase y muestra el aviso", async () => {
    const supabase = stubSupabase();

    const { result } = await runRedeem(LINK, {});

    expect(result).toMatchObject({ data: { status: "invalid_link" } });
    expect(supabase.requests).toEqual([]);
  });

  it.each([
    ["un buyer", { ...ADMIN_PROFILE, role: "buyer" as const }],
    ["un desactivado", { ...ADMIN_PROFILE, is_active: false }],
    ["una cuenta sin perfil", null],
  ])("%s no queda con sesión", async (_name, profile) => {
    const supabase = stubSupabase({ profile });

    const { result, cookies } = await runRedeem(LINK);

    expect(result).toMatchObject({ data: { status: "invalid_link" } });
    expect(supabase.requests.join()).toContain("/auth/v1/logout");
    expect(hasLiveSession(cookies)).toBe(false);
  });

  it.each([429, 500])(
    "si Auth falla (%i) lo dice sin dar por muerto el enlace",
    async (verifyFailureStatus) => {
      stubSupabase({ verifyFailureStatus });

      const { result, cookies } = await runRedeem(LINK);

      expect(result).toMatchObject({
        data: { status: "unavailable" },
        init: { status: 503 },
      });
      expect(hasLiveSession(cookies)).toBe(false);
    },
  );
});
