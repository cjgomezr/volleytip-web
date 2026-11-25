import { RouterContextProvider, type MiddlewareFunction } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_PROFILE,
  buildSessionCookie,
  FAKE_USER_ID,
  stubSupabase,
  type FakeProfile,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import {
  attachPanelSession,
  panelMemberContext,
  rejectForeignOrigin,
  requireAdmin,
  requirePanelMember,
} from "./panel-middleware.server";

const SIGNED_IN = buildSessionCookie(TEST_ENV.SUPABASE_URL);
const STAFF_PROFILE: FakeProfile = { ...ADMIN_PROFILE, role: "staff" };
const BUYER_PROFILE: FakeProfile = { ...ADMIN_PROFILE, role: "buyer" };

type Middleware = MiddlewareFunction<Response>;

interface PanelRequest {
  readonly path?: string;
  readonly method?: string;
  readonly cookie?: string;
  readonly origin?: string;
  readonly isAdminOnly?: boolean;
}

interface PanelOutcome {
  readonly response: Response;
  readonly thrown: unknown;
  /** Si la petición pasó la guardia y llegó al loader o al action. */
  readonly reachedRoute: boolean;
  readonly context: RouterContextProvider;
}

function toResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  if (typeof error === "object" && error !== null && "init" in error) {
    return new Response(null, error.init as ResponseInit);
  }
  return new Response(null, { status: 500 });
}

function buildRequest({
  path = "/admin",
  method = "GET",
  cookie,
  origin,
}: PanelRequest): Request {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("Cookie", cookie);
  if (origin !== undefined) headers.set("Origin", origin);
  return new Request(`http://localhost${path}`, { method, headers });
}

/** Encadena los middlewares como lo hace React Router: lo que uno lanza sube
 * como respuesta por el `next()` de los de arriba. */
async function runPanel(options: PanelRequest): Promise<PanelOutcome> {
  const context = new RouterContextProvider();
  const args = {
    request: buildRequest(options),
    context,
    params: {},
  } as unknown as Parameters<Middleware>[0];
  const chain: Middleware[] = [
    attachPanelSession,
    rejectForeignOrigin,
    requirePanelMember,
    ...(options.isAdminOnly ? [requireAdmin] : []),
  ];
  let thrown: unknown;
  let reachedRoute = false;

  async function runFrom(index: number): Promise<Response> {
    const middleware = chain[index];
    if (middleware === undefined) {
      reachedRoute = true;
      return new Response("página", { status: 200 });
    }
    let nextResponse: Response | undefined;
    const next = async (): Promise<Response> => {
      nextResponse = await runFrom(index + 1);
      return nextResponse;
    };
    try {
      const returned = await middleware(args, next);
      return returned ?? nextResponse ?? (await next());
    } catch (error) {
      thrown = error;
      return toResponse(error);
    }
  }

  const response = await runFrom(0);
  return { response, thrown, reachedRoute, context };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guardia del panel", () => {
  it.each([
    ["/admin", "/admin/entrar?next=%2Fadmin"],
    ["/en/admin", "/en/admin/sign-in?next=%2Fen%2Fadmin"],
    ["/admin/pedidos/7", "/admin/entrar?next=%2Fadmin%2Fpedidos%2F7"],
  ])("sin sesión redirige %s a %s", async (path, destination) => {
    stubSupabase();

    const { response, reachedRoute } = await runPanel({ path });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(destination);
    expect(reachedRoute).toBe(false);
  });

  it("con un token que Supabase rechaza redirige a la entrada", async () => {
    stubSupabase();
    const forged = buildSessionCookie(TEST_ENV.SUPABASE_URL, {
      accessToken: "token-inventado",
    });

    const { response, reachedRoute } = await runPanel({ cookie: forged });

    expect(response.status).toBe(302);
    expect(reachedRoute).toBe(false);
  });

  it("con el refresco vencido redirige y borra la cookie", async () => {
    stubSupabase();
    const dead = buildSessionCookie(TEST_ENV.SUPABASE_URL, {
      isExpired: true,
      refreshToken: "refresco-vencido",
    });

    const { response } = await runPanel({ cookie: dead });

    expect(response.status).toBe(302);
    expect(response.headers.getSetCookie().join()).toMatch(/Max-Age=0/i);
  });

  it("un admin activo pasa y su perfil queda en el contexto", async () => {
    stubSupabase();

    const { response, context } = await runPanel({ cookie: SIGNED_IN });

    expect(response.status).toBe(200);
    expect(context.get(panelMemberContext)).toEqual({
      id: FAKE_USER_ID,
      email: ADMIN_PROFILE.email,
      fullName: ADMIN_PROFILE.full_name,
      role: "admin",
    });
  });

  it("lee el rol y el estado de profiles, con la sesión de la persona", async () => {
    const supabase = stubSupabase();

    await runPanel({ cookie: SIGNED_IN });

    expect(supabase.requests).toContain(
      `GET /rest/v1/profiles?select=role%2Cis_active%2Cfull_name%2Cemail&id=eq.${FAKE_USER_ID}`,
    );
    expect(supabase.profileAuthorizations).toEqual(["Bearer acceso-vigente"]);
  });

  it("un token renovado sale en las cookies de la respuesta", async () => {
    stubSupabase();
    const expired = buildSessionCookie(TEST_ENV.SUPABASE_URL, {
      isExpired: true,
    });

    const { response, reachedRoute } = await runPanel({ cookie: expired });

    expect(reachedRoute).toBe(true);
    expect(response.headers.getSetCookie().join()).toMatch(/-auth-token=/);
  });

  it.each(["/admin", "/en/admin/lo-que-sea"])(
    "un buyer recibe 404 en %s",
    async (path) => {
      stubSupabase({ profile: BUYER_PROFILE });

      const { response, reachedRoute, thrown } = await runPanel({
        path,
        cookie: SIGNED_IN,
      });

      expect(response.status).toBe(404);
      expect(reachedRoute).toBe(false);
      expect(thrown).toMatchObject({ data: { kind: "panel-not-found" } });
    },
  );

  it.each([
    ["una cuenta sin perfil", null],
    ["un buyer desactivado", { ...BUYER_PROFILE, is_active: false }],
  ])("%s recibe 404", async (_name, profile) => {
    stubSupabase({ profile });

    const { response } = await runPanel({ cookie: SIGNED_IN });

    expect(response.status).toBe(404);
  });

  it.each(["admin", "staff"] as const)(
    "un %s desactivado pierde el acceso con la sesión abierta",
    async (role) => {
      stubSupabase({ profile: { ...ADMIN_PROFILE, role, is_active: false } });

      const { response, reachedRoute } = await runPanel({ cookie: SIGNED_IN });

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/admin/entrar?next=%2Fadmin",
      );
      expect(reachedRoute).toBe(false);
    },
  );

  it("un staff activo llega a su pantalla", async () => {
    stubSupabase({ profile: STAFF_PROFILE });

    const { reachedRoute, context } = await runPanel({ cookie: SIGNED_IN });

    expect(reachedRoute).toBe(true);
    expect(context.get(panelMemberContext).role).toBe("staff");
  });

  it.each([
    ["/admin/pedidos", "/admin"],
    ["/en/admin/orders", "/en/admin"],
  ])("un staff en %s vuelve a %s", async (path, home) => {
    stubSupabase({ profile: STAFF_PROFILE });

    const { response, reachedRoute } = await runPanel({
      path,
      cookie: SIGNED_IN,
      isAdminOnly: true,
    });

    expect(response.headers.get("Location")).toBe(home);
    expect(reachedRoute).toBe(false);
  });

  it("un admin pasa a las rutas solo de admin", async () => {
    stubSupabase();

    const { reachedRoute } = await runPanel({
      path: "/admin/pedidos",
      cookie: SIGNED_IN,
      isAdminOnly: true,
    });

    expect(reachedRoute).toBe(true);
  });

  it("falla en voz alta si Supabase Auth está caído", async () => {
    stubSupabase({ authFailureStatus: 500 });

    const { response, thrown } = await runPanel({ cookie: SIGNED_IN });

    expect(response.status).toBe(500);
    expect(thrown).toBeInstanceOf(Error);
  });

  it("falla en voz alta si no puede leer el perfil", async () => {
    stubSupabase({ profileFailureStatus: 500 });

    const { response, reachedRoute } = await runPanel({ cookie: SIGNED_IN });

    expect(response.status).toBe(500);
    expect(reachedRoute).toBe(false);
  });

  it("pide no indexar ni guardar en caché lo que responde el panel", async () => {
    stubSupabase();

    const { response } = await runPanel({ cookie: SIGNED_IN });

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("guardia del panel: POST", () => {
  it("un envío del propio sitio llega al action", async () => {
    stubSupabase();

    const { reachedRoute } = await runPanel({
      method: "POST",
      cookie: SIGNED_IN,
      origin: TEST_ENV.SITE_ORIGIN,
    });

    expect(reachedRoute).toBe(true);
  });

  it.each([
    ["ajeno", "https://sitio-ajeno.test"],
    ["ausente", undefined],
  ])("con un origen %s responde 403 sin tocar Supabase", async (_n, origin) => {
    const supabase = stubSupabase();

    const { response, reachedRoute } = await runPanel({
      method: "POST",
      cookie: SIGNED_IN,
      origin,
    });

    expect(response.status).toBe(403);
    expect(reachedRoute).toBe(false);
    expect(supabase.requests).toEqual([]);
  });

  it("sin sesión no ejecuta nada y redirige a la entrada", async () => {
    stubSupabase();

    const { response, reachedRoute } = await runPanel({
      method: "POST",
      origin: TEST_ENV.SITE_ORIGIN,
    });

    expect(response.headers.get("Location")).toBe("/admin/entrar");
    expect(reachedRoute).toBe(false);
  });

  it("de un buyer responde 404 sin ejecutar nada", async () => {
    stubSupabase({ profile: BUYER_PROFILE });

    const { response, reachedRoute } = await runPanel({
      method: "POST",
      cookie: SIGNED_IN,
      origin: TEST_ENV.SITE_ORIGIN,
    });

    expect(response.status).toBe(404);
    expect(reachedRoute).toBe(false);
  });
});
