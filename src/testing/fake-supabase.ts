import { vi } from "vitest";

/**
 * Un Supabase de mentira para las pruebas de la sesión: sustituye `fetch` y
 * contesta lo que el servicio de Auth y la API contestarían. Ninguna petición
 * sale a la red. Las pruebas contra la base local de verdad viven en
 * `src/db/panel-session.integration.test.ts`.
 */
export interface FakeProfile {
  readonly role: "admin" | "staff" | "buyer";
  readonly is_active: boolean;
  readonly full_name: string | null;
  readonly email: string;
}

export const FAKE_USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
export const VALID_ACCESS_TOKEN = "acceso-vigente";
export const RENEWED_ACCESS_TOKEN = "acceso-renovado";
export const VALID_REFRESH_TOKEN = "refresco-vigente";

const ONE_HOUR_IN_SECONDS = 3600;

export const ADMIN_PROFILE: FakeProfile = {
  role: "admin",
  is_active: true,
  full_name: "Andrés Gómez",
  email: "andres@prueba.volleytip.test",
};

export interface FakeSupabaseOptions {
  /** El perfil del usuario; `null` si no tiene ninguno. */
  readonly profile?: FakeProfile | null;
  /** Estado con que fallan todas las peticiones a Auth (servicio caído). */
  readonly authFailureStatus?: number;
  /** Estado con que falla la lectura del perfil. */
  readonly profileFailureStatus?: number;
}

export interface FakeSupabase {
  /** Cada petición como `MÉTODO /ruta?búsqueda`. */
  readonly requests: string[];
  /** La cabecera `Authorization` con que se leyó el perfil. */
  readonly profileAuthorizations: (string | null)[];
}

function buildUser(): Record<string, unknown> {
  return {
    id: FAKE_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: ADMIN_PROFILE.email,
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-11-01T00:00:00Z",
  };
}

function buildSession(
  accessToken: string,
  expiresInSeconds: number,
): Record<string, unknown> {
  return {
    access_token: accessToken,
    refresh_token: VALID_REFRESH_TOKEN,
    token_type: "bearer",
    expires_in: ONE_HOUR_IN_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    user: buildUser(),
  };
}

function authError(status: number, code: string): Response {
  return Response.json(
    { code: status, error_code: code, msg: code },
    { status },
  );
}

async function answerRefresh(request: Request): Promise<Response> {
  const body = (await request.json()) as { refresh_token?: string };
  return body.refresh_token === VALID_REFRESH_TOKEN
    ? Response.json(buildSession(RENEWED_ACCESS_TOKEN, ONE_HOUR_IN_SECONDS))
    : authError(400, "refresh_token_not_found");
}

function answerUser(request: Request): Response {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return token === VALID_ACCESS_TOKEN || token === RENEWED_ACCESS_TOKEN
    ? Response.json(buildUser())
    : authError(403, "bad_jwt");
}

export function stubSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const { profile = ADMIN_PROFILE } = options;
  const requests: string[] = [];
  const profileAuthorizations: (string | null)[] = [];

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (url.pathname.startsWith("/auth/") && options.authFailureStatus) {
      return authError(options.authFailureStatus, "unexpected_failure");
    }
    if (url.pathname === "/auth/v1/token") return answerRefresh(request);
    if (url.pathname === "/auth/v1/user") return answerUser(request);
    if (url.pathname === "/auth/v1/logout") {
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/profiles") {
      profileAuthorizations.push(request.headers.get("authorization"));
      return options.profileFailureStatus
        ? Response.json(
            { message: "falló" },
            { status: options.profileFailureStatus },
          )
        : Response.json(profile === null ? [] : [profile]);
    }
    // Los ajustes del sitio (la barra de anuncios del 404).
    return Response.json([]);
  }

  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      answer(new Request(input, init)),
  );
  return { requests, profileAuthorizations };
}

interface SessionCookieOptions {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly isExpired?: boolean;
}

/** La cabecera `Cookie` que mandaría un navegador con esa sesión, en el
 * proyecto de Supabase de `supabaseUrl`. */
export function buildSessionCookie(
  supabaseUrl: string,
  {
    accessToken = VALID_ACCESS_TOKEN,
    refreshToken = VALID_REFRESH_TOKEN,
    isExpired = false,
  }: SessionCookieOptions = {},
): string {
  const [projectName = ""] = new URL(supabaseUrl).hostname.split(".");
  const session = {
    ...buildSession(
      accessToken,
      isExpired ? -ONE_HOUR_IN_SECONDS : ONE_HOUR_IN_SECONDS,
    ),
    refresh_token: refreshToken,
  };
  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `sb-${projectName}-auth-token=base64-${encoded}`;
}
