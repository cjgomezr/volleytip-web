import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_PROFILE,
  stubSupabase,
  VALID_AUTH_CODE,
  type FakeSupabaseOptions,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";

const RETURN = "/admin/entrar/google/vuelta";

type RouteFunction = (args: never) => unknown;

interface Run {
  readonly result: unknown;
  /** Las cookies que la respuesta pondría en el navegador. */
  readonly cookies: string[];
}

interface Visit {
  readonly cookie?: string;
  readonly fields?: Readonly<Record<string, string>>;
}

interface Routes {
  readonly start: (
    path?: string,
    fields?: Readonly<Record<string, string>>,
  ) => Promise<Run>;
  readonly openStart: (path: string) => Promise<Run>;
  readonly comeBack: (path: string, cookie?: string) => Promise<Run>;
  readonly openSignIn: (path: string) => Promise<unknown>;
}

// El entorno se lee al cargar el módulo: cada prueba carga las rutas de nuevo.
async function loadRoutes(googleFlag: string): Promise<Routes> {
  vi.resetModules();
  vi.stubEnv("GOOGLE_SIGN_IN_ENABLED", googleFlag);
  const start = await import("./sign-in-google");
  const back = await import("./sign-in-google-return");
  const signIn = await import("./sign-in");
  const middleware = await import("~/lib/panel/panel-middleware.server");
  const session = await import("~/lib/supabase/session-client.server");

  async function run(
    route: RouteFunction,
    path: string,
    { cookie, fields }: Visit = {},
  ): Promise<Run> {
    const request = new Request(`http://localhost${path}`, {
      method: fields === undefined ? "GET" : "POST",
      headers: cookie === undefined ? {} : { Cookie: cookie },
      body: fields === undefined ? undefined : new URLSearchParams(fields),
    });
    const supabaseSession = session.createSessionSupabaseClient(request);
    const context = new RouterContextProvider();
    context.set(middleware.panelSessionContext, supabaseSession);
    let result: unknown;
    try {
      result = await route({ request, context, params: {} } as never);
    } catch (error) {
      result = error;
    }
    const headers = new Headers();
    supabaseSession.writeCookies(headers);
    return { result, cookies: headers.getSetCookie() };
  }

  return {
    start: (path = "/admin/entrar/google", fields = {}) =>
      run(start.action as RouteFunction, path, { fields }),
    openStart: (path) => run(start.loader as RouteFunction, path),
    comeBack: (path, cookie) =>
      run(back.loader as RouteFunction, path, { cookie }),
    openSignIn: async (path) =>
      (await run(signIn.loader as RouteFunction, path)).result,
  };
}

function readLocation(result: unknown): string {
  expect(result).toBeInstanceOf(Response);
  return (result as Response).headers.get("Location") ?? "";
}

function readGoogleReturn(result: unknown): string {
  const target = new URL(readLocation(result));
  return target.searchParams.get("redirect_to") ?? "";
}

/** La cabecera `Cookie` con la que el navegador volvería de Google. */
async function leaveForGoogle(routes: Routes): Promise<string> {
  const { cookies } = await routes.start();
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function hasLiveSession(cookies: readonly string[]): boolean {
  const last = cookies
    .filter((cookie) => /-auth-token(\.\d+)?=/.test(cookie))
    .at(-1);
  return last !== undefined && !last.includes("Max-Age=0");
}

async function comeBackWithCode(
  options: FakeSupabaseOptions = {},
  query = "",
): Promise<Run & { readonly requests: string[] }> {
  const supabase = stubSupabase(options);
  const routes = await loadRoutes("true");
  const cookie = await leaveForGoogle(routes);
  const run = await routes.comeBack(
    `${RETURN}?code=${VALID_AUTH_CODE}${query}`,
    cookie,
  );
  return { ...run, requests: supabase.requests };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("google: inicio", () => {
  it.each([
    ["/admin/entrar/google", RETURN],
    ["/en/admin/sign-in/google", "/en/admin/sign-in/google/return"],
  ])(
    "desde %s pide a Supabase la dirección de Google con la vuelta al sitio",
    async (path, back) => {
      stubSupabase();
      const routes = await loadRoutes("true");

      const { result } = await routes.start(path);

      const target = new URL(readLocation(result));
      expect(`${target.origin}${target.pathname}`).toBe(
        `${TEST_ENV.SUPABASE_URL}/auth/v1/authorize`,
      );
      expect(target.searchParams.get("provider")).toBe("google");
      expect(target.searchParams.get("code_challenge")).toBeTruthy();
      expect(readGoogleReturn(result)).toBe(`${TEST_ENV.SITE_ORIGIN}${back}`);
    },
  );

  it("guarda en una cookie HttpOnly lo que la vuelta necesita para canjear", async () => {
    stubSupabase();
    const routes = await loadRoutes("true");

    const { cookies } = await routes.start();

    expect(cookies).toContainEqual(
      expect.stringMatching(/-auth-token-code-verifier=.+HttpOnly/),
    );
    expect(cookies.filter((cookie) => !cookie.includes("HttpOnly"))).toEqual(
      [],
    );
    expect(hasLiveSession(cookies)).toBe(false);
  });

  it("la vuelta lleva la página del panel que se había pedido", async () => {
    stubSupabase();
    const routes = await loadRoutes("true");

    const { result } = await routes.start("/admin/entrar/google", {
      next: "/admin/mensajes?page=2",
    });

    const back = new URL(readGoogleReturn(result));
    expect(back.origin).toBe(TEST_ENV.SITE_ORIGIN);
    expect(back.searchParams.get("next")).toBe("/admin/mensajes?page=2");
  });

  it("sin Google configurado responde 404 y no deja cookies", async () => {
    stubSupabase();
    const routes = await loadRoutes("false");

    const { result, cookies } = await routes.start();

    expect(result).toMatchObject({ init: { status: 404 } });
    expect(cookies).toEqual([]);
  });

  it("abrir la dirección no empieza nada: lleva a la entrada", async () => {
    stubSupabase();
    const routes = await loadRoutes("true");

    const { result, cookies } = await routes.openStart("/admin/entrar/google");

    expect(readLocation(result)).toBe("/admin/entrar");
    expect(cookies).toEqual([]);
  });
});

describe("google: vuelta", () => {
  it.each(["admin", "staff"] as const)(
    "el correo de un %s activo queda con sesión y llega al panel",
    async (role) => {
      const { result, cookies } = await comeBackWithCode({
        profile: { ...ADMIN_PROFILE, role },
      });

      expect(readLocation(result)).toBe("/admin");
      expect(hasLiveSession(cookies)).toBe(true);
      expect(cookies.join()).toContain("HttpOnly");
    },
  );

  it("llega a la página que había pedido antes de entrar", async () => {
    const { result } = await comeBackWithCode({}, "&next=%2Fadmin%2Fmensajes");

    expect(readLocation(result)).toBe("/admin/mensajes");
  });

  it("sin página pedida llega al panel en el idioma del perfil", async () => {
    const { result } = await comeBackWithCode({ profileLocale: "en" });

    expect(readLocation(result)).toBe("/en/admin");
  });

  it.each([
    ["un correo sin perfil", null],
    ["un buyer", { ...ADMIN_PROFILE, role: "buyer" as const }],
    ["un miembro desactivado", { ...ADMIN_PROFILE, is_active: false }],
  ])(
    "%s queda sin sesión, con el mensaje, y no se escribe nada",
    async (_name, profile) => {
      const { result, cookies, requests } = await comeBackWithCode({
        profile,
      });

      expect(readLocation(result)).toBe("/admin/entrar?google=denied");
      expect(hasLiveSession(cookies)).toBe(false);
      expect(requests).toContain("POST /auth/v1/logout?scope=local");
      expect(
        requests.filter((request) =>
          /^(POST|PATCH|PUT|DELETE) \/(rest|auth\/v1\/(signup|admin))/.test(
            request,
          ),
        ),
      ).toEqual([]);
    },
  );

  it("si el cierre falla en Supabase, un ajeno tampoco se queda con sesión", async () => {
    stubSupabase({ profile: null, logoutFailureStatus: 500 });
    const routes = await loadRoutes("true");
    const cookie = await leaveForGoogle(routes);

    const { cookies } = await routes.comeBack(
      `${RETURN}?code=${VALID_AUTH_CODE}`,
      cookie,
    );

    expect(hasLiveSession(cookies)).toBe(false);
  });

  it("si no puede comprobar el perfil, no deja la sesión", async () => {
    const { result, cookies } = await comeBackWithCode({
      profileFailureStatus: 500,
    });

    expect(result).toBeInstanceOf(Error);
    expect(hasLiveSession(cookies)).toBe(false);
  });

  // Con el registro apagado, así vuelve un correo que nadie invitó.
  it("el rechazo de Supabase por registro apagado dice que no tiene acceso", async () => {
    const supabase = stubSupabase();
    const routes = await loadRoutes("true");

    const { result, cookies } = await routes.comeBack(
      `${RETURN}?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed`,
    );

    expect(readLocation(result)).toBe("/admin/entrar?google=denied");
    expect(cookies).toEqual([]);
    expect(supabase.codeExchanges).toEqual([]);
  });

  it.each([
    ["cancelar en Google", "?error=access_denied"],
    ["un error de Google", "?error=server_error&error_code=unexpected_failure"],
    ["un error junto a un código", `?error=x&code=${VALID_AUTH_CODE}`],
    ["una vuelta sin código", ""],
    ["un código vacío", "?code="],
    ["un código con otra forma", "?code=%3Cscript%3E"],
  ])(
    "%s vuelve a la entrada con un mensaje y sin sesión",
    async (_n, query) => {
      const supabase = stubSupabase();
      const routes = await loadRoutes("true");
      const cookie = await leaveForGoogle(routes);

      const { result, cookies } = await routes.comeBack(
        `${RETURN}${query}`,
        cookie,
      );

      expect(readLocation(result)).toBe("/admin/entrar?google=failed");
      expect(hasLiveSession(cookies)).toBe(false);
      expect(supabase.codeExchanges).toEqual([]);
    },
  );

  it("un código alterado vuelve con un mensaje y sin sesión", async () => {
    stubSupabase();
    const routes = await loadRoutes("true");
    const cookie = await leaveForGoogle(routes);

    const { result, cookies } = await routes.comeBack(
      `${RETURN}?code=${VALID_AUTH_CODE.replace("0", "1")}`,
      cookie,
    );

    expect(readLocation(result)).toBe("/admin/entrar?google=failed");
    expect(hasLiveSession(cookies)).toBe(false);
  });

  it("un código ya usado vuelve con un mensaje y sin sesión", async () => {
    stubSupabase();
    const routes = await loadRoutes("true");
    const cookie = await leaveForGoogle(routes);
    const path = `${RETURN}?code=${VALID_AUTH_CODE}`;
    await routes.comeBack(path, cookie);

    const { result, cookies } = await routes.comeBack(path, cookie);

    expect(readLocation(result)).toBe("/admin/entrar?google=failed");
    expect(hasLiveSession(cookies)).toBe(false);
  });

  it("un código en un navegador que no empezó el flujo no sirve", async () => {
    const supabase = stubSupabase();
    const routes = await loadRoutes("true");

    const { result, cookies } = await routes.comeBack(
      `${RETURN}?code=${VALID_AUTH_CODE}`,
    );

    expect(readLocation(result)).toBe("/admin/entrar?google=failed");
    expect(hasLiveSession(cookies)).toBe(false);
    expect(supabase.codeExchanges).toEqual([]);
  });

  it("si Supabase Auth falla, vuelve con un mensaje y lo deja en el registro", async () => {
    const { result, cookies } = await comeBackWithCode({
      exchangeFailureStatus: 500,
    });

    expect(readLocation(result)).toBe("/admin/entrar?google=failed");
    expect(hasLiveSession(cookies)).toBe(false);
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      VALID_AUTH_CODE,
    );
  });

  it("en inglés vuelve a la entrada en inglés, con la página pedida", async () => {
    stubSupabase();
    const routes = await loadRoutes("true");

    const { result } = await routes.comeBack(
      "/en/admin/sign-in/google/return?error=access_denied&next=%2Fen%2Fadmin%2Fmore",
    );

    expect(readLocation(result)).toBe(
      "/en/admin/sign-in?next=%2Fen%2Fadmin%2Fmore&google=failed",
    );
  });
});

describe("google: regreso", () => {
  const EXTERNAL = [
    "https://sitio-ajeno.test",
    "https://sitio-ajeno.test/admin",
    "//sitio-ajeno.test/admin",
    "/\\sitio-ajeno.test",
    "javascript:alert(1)",
    "/contacto",
    "/admin/../contacto",
  ];

  it.each(EXTERNAL)("al salir hacia Google ignora next=%s", async (next) => {
    stubSupabase();
    const routes = await loadRoutes("true");

    const { result } = await routes.start("/admin/entrar/google", { next });

    expect(readGoogleReturn(result)).toBe(`${TEST_ENV.SITE_ORIGIN}${RETURN}`);
  });

  it.each(EXTERNAL)("al volver ignora next=%s", async (next) => {
    const { result } = await comeBackWithCode(
      {},
      `&next=${encodeURIComponent(next)}`,
    );

    expect(readLocation(result)).toBe("/admin");
  });

  it("un rechazo no arrastra una dirección externa", async () => {
    stubSupabase();
    const routes = await loadRoutes("true");

    const { result } = await routes.comeBack(
      `${RETURN}?error=x&next=https%3A%2F%2Fsitio-ajeno.test`,
    );

    expect(readLocation(result)).toBe("/admin/entrar?google=failed");
  });
});

describe("google: pantalla de entrada", () => {
  it.each([
    ["true", true],
    ["false", false],
    ["", false],
  ])("con la bandera en %j dice si hay botón: %s", async (flag, expected) => {
    stubSupabase();
    const routes = await loadRoutes(flag);

    await expect(routes.openSignIn("/admin/entrar")).resolves.toMatchObject({
      isGoogleEnabled: expected,
    });
  });

  it.each([
    ["?google=denied", "denied"],
    ["?google=failed", "failed"],
    ["?google=otra-cosa", null],
    ["", null],
  ])("con %j el mensaje es %s", async (query, googleNotice) => {
    stubSupabase();
    const routes = await loadRoutes("true");

    await expect(
      routes.openSignIn(`/admin/entrar${query}`),
    ).resolves.toMatchObject({ googleNotice });
  });
});
