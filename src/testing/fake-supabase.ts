import { vi } from "vitest";

import {
  createMessagesTable,
  type FakeMessagesOptions,
  type FakeMessagesTable,
} from "./fake-messages-table";

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
/** El código con el que Auth vuelve de Google. Sirve una sola vez. */
export const VALID_AUTH_CODE = "0b6f5a3e-2f4d-4c1a-9a6e-1d2c3b4a5f60";

const ONE_HOUR_IN_SECONDS = 3600;

export const ADMIN_PROFILE: FakeProfile = {
  role: "admin",
  is_active: true,
  full_name: "Andrés Gómez",
  email: "andres@prueba.volleytip.test",
};

export interface FakeSupabaseOptions extends FakeMessagesOptions {
  /** El perfil del usuario; `null` si no tiene ninguno. */
  readonly profile?: FakeProfile | null;
  /** Estado con que fallan todas las peticiones a Auth (servicio caído). */
  readonly authFailureStatus?: number;
  /** Estado con que falla solo el cierre de sesión. */
  readonly logoutFailureStatus?: number;
  /** Estado con que falla la lectura del perfil. */
  readonly profileFailureStatus?: number;
  /** El idioma guardado en el perfil. */
  readonly profileLocale?: string;
  /** Estado con que falla el cambio del perfil. */
  readonly profileUpdateFailureStatus?: number;
  /** El cambio del perfil no toca ninguna fila, como cuando RLS lo tapa. */
  readonly isProfileUpdateIgnored?: boolean;
  /** Estado con que falla el canje de un enlace. */
  readonly verifyFailureStatus?: number;
  /** Estado con que falla el canje de un código de Google. */
  readonly exchangeFailureStatus?: number;
  /** Estado con que falla la escritura en la bitácora. */
  readonly auditFailureStatus?: number;
  /** Las filas de `settings`: clave y valor guardado. */
  readonly settings?: Readonly<Record<string, unknown>>;
  /** Estado con que falla la lectura de `settings`. */
  readonly settingsReadFailureStatus?: number;
  /** Estado con que falla la escritura en `settings`. */
  readonly settingsWriteFailureStatus?: number;
}

export interface FakeProfileUpdate {
  /** La ruta con su búsqueda. */
  readonly path: string;
  readonly body: unknown;
  readonly authorization: string | null;
}

export interface FakeSupabase extends Pick<FakeMessagesTable, "messageWrites"> {
  /** Cada petición como `MÉTODO /ruta?búsqueda`. */
  readonly requests: string[];
  /** La cabecera `Authorization` con que se leyó el perfil. */
  readonly profileAuthorizations: (string | null)[];
  /** Cada cambio pedido al perfil, aceptado o no. */
  readonly profileUpdates: FakeProfileUpdate[];
  /** Las filas que se mandaron a `audit_log`, aceptadas o no. */
  readonly auditRows: unknown[];
  /** El cuerpo de cada canje de enlace pedido, aceptado o no. */
  readonly verifications: unknown[];
  /** El cuerpo de cada canje de un código pedido, aceptado o no. */
  readonly codeExchanges: unknown[];
  /** Cada ajuste que se mandó a guardar, aceptado o no. */
  readonly settingsWrites: FakeSettingWrite[];
}

export interface FakeSettingWrite {
  readonly body: unknown;
  readonly authorization: string | null;
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

function apiFailure(status: number): Response {
  return Response.json({ message: "falló" }, { status });
}

function answerProfileUpdate(options: FakeSupabaseOptions): Response {
  if (options.profileUpdateFailureStatus) {
    return apiFailure(options.profileUpdateFailureStatus);
  }
  return Response.json(
    options.isProfileUpdateIgnored ? [] : [{ id: FAKE_USER_ID }],
  );
}

async function readProfileUpdate(request: Request): Promise<FakeProfileUpdate> {
  const url = new URL(request.url);
  return {
    path: `${url.pathname}${url.search}`,
    body: await request.json(),
    authorization: request.headers.get("authorization"),
  };
}

function answerVerify(options: FakeSupabaseOptions): Response {
  return options.verifyFailureStatus
    ? authError(options.verifyFailureStatus, "otp_expired")
    : Response.json(buildSession(VALID_ACCESS_TOKEN, ONE_HOUR_IN_SECONDS));
}

// Como Auth: un código desconocido o ya canjeado no encuentra su flujo.
function createCodeExchange(
  { exchangeFailureStatus }: FakeSupabaseOptions,
  exchanges: unknown[],
): (request: Request) => Promise<Response> {
  let isSpent = false;
  return async (request) => {
    const body = (await request.json()) as { auth_code?: string };
    exchanges.push(body);
    if (exchangeFailureStatus) {
      return authError(exchangeFailureStatus, "unexpected_failure");
    }
    if (isSpent || body.auth_code !== VALID_AUTH_CODE) {
      return authError(404, "flow_state_not_found");
    }
    isSpent = true;
    return Response.json(buildSession(VALID_ACCESS_TOKEN, ONE_HOUR_IN_SECONDS));
  };
}

function answerSettingsRead(
  url: URL,
  { settings = {}, settingsReadFailureStatus }: FakeSupabaseOptions,
): Response {
  if (settingsReadFailureStatus) return apiFailure(settingsReadFailureStatus);
  const filter = url.searchParams.get("key") ?? "";
  return Response.json(
    Object.entries(settings)
      .filter(([key]) => filter.includes(key))
      .map(([key, value]) => ({ key, value })),
  );
}

export function stubSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const { profile = ADMIN_PROFILE } = options;
  const requests: string[] = [];
  const profileAuthorizations: (string | null)[] = [];
  const profileUpdates: FakeProfileUpdate[] = [];
  const auditRows: unknown[] = [];
  const verifications: unknown[] = [];
  const settingsWrites: FakeSettingWrite[] = [];
  const codeExchanges: unknown[] = [];
  const messages = createMessagesTable(options);
  const answerCodeExchange = createCodeExchange(options, codeExchanges);

  async function answerSettings(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return answerSettingsRead(new URL(request.url), options);
    }
    const body = (await request.json()) as { key?: string };
    settingsWrites.push({
      body,
      authorization: request.headers.get("authorization"),
    });
    return options.settingsWriteFailureStatus
      ? apiFailure(options.settingsWriteFailureStatus)
      : Response.json([{ key: body.key }], { status: 201 });
  }

  async function answerAuditInsert(request: Request): Promise<Response> {
    auditRows.push(await request.json());
    return options.auditFailureStatus
      ? apiFailure(options.auditFailureStatus)
      : new Response(null, { status: 201 });
  }

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (url.pathname.startsWith("/auth/") && options.authFailureStatus) {
      return authError(options.authFailureStatus, "unexpected_failure");
    }
    if (url.pathname === "/auth/v1/token") {
      return url.searchParams.get("grant_type") === "pkce"
        ? answerCodeExchange(request)
        : answerRefresh(request);
    }
    if (url.pathname === "/auth/v1/user") return answerUser(request);
    if (url.pathname === "/auth/v1/verify") {
      verifications.push(await request.json());
      return answerVerify(options);
    }
    if (url.pathname === "/auth/v1/logout") {
      if (options.logoutFailureStatus) {
        return authError(options.logoutFailureStatus, "unexpected_failure");
      }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/profiles") {
      if (request.method === "PATCH") {
        profileUpdates.push(await readProfileUpdate(request));
        return answerProfileUpdate(options);
      }
      profileAuthorizations.push(request.headers.get("authorization"));
      const locale = options.profileLocale ?? "es";
      return options.profileFailureStatus
        ? apiFailure(options.profileFailureStatus)
        : Response.json(profile === null ? [] : [{ ...profile, locale }]);
    }
    if (url.pathname === "/rest/v1/audit_log") {
      return answerAuditInsert(request);
    }
    if (url.pathname === "/rest/v1/settings") return answerSettings(request);
    if (url.pathname === "/rest/v1/messages") return messages.answer(request);
    // Como la base recién migrada: los dos idiomas del sitio, activos.
    if (url.pathname === "/rest/v1/languages") {
      return Response.json([{ code: "es" }, { code: "en" }]);
    }
    return Response.json([]);
  }

  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      answer(new Request(input, init)),
  );
  return {
    requests,
    profileAuthorizations,
    profileUpdates,
    auditRows,
    verifications,
    codeExchanges,
    settingsWrites,
    messageWrites: messages.messageWrites,
  };
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
