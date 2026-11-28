import { vi } from "vitest";

import {
  stubSupabase,
  type FakeSupabase,
  type FakeSupabaseOptions,
} from "./fake-supabase";

export interface FakeTeamRow {
  id: string;
  email: string;
  role: "admin" | "staff" | "buyer";
  is_active: boolean;
  full_name: string | null;
}

export interface FakeAccountFailure {
  readonly status: number;
  readonly code: string;
}

export interface FakeTeamOptions extends FakeSupabaseOptions {
  /** Los perfiles que existen. */
  readonly team?: readonly FakeTeamRow[];
  /** El último ingreso de cada cuenta, por id. Sin él, nunca ha entrado. */
  readonly lastSignIns?: Readonly<Record<string, string>>;
  /** Estado y código con que Auth falla al leer una cuenta, por id. */
  readonly accountFailures?: Readonly<Record<string, FakeAccountFailure>>;
  /** Estado y código con que Auth falla al cambiar cualquier cuenta. */
  readonly accountUpdateFailure?: FakeAccountFailure;
  /** Otra persona crea esa cuenta justo antes: Auth rechaza la nueva y su
   * perfil ya está. */
  readonly concurrentAccount?: FakeTeamRow;
  /** Auth falla al crear una cuenta. */
  readonly createFailure?: boolean;
  /** Lo que otra persona cambia entre la lectura y la escritura. */
  readonly beforeUpdate?: (rows: FakeTeamRow[]) => void;
  /** El mensaje con que la base rechaza todo cambio de un perfil. */
  readonly updateRejection?: string;
}

export interface FakeTeamWrite {
  readonly body: unknown;
  readonly authorization: string | null;
}

export interface FakeTeamApi extends FakeSupabase {
  /** Los perfiles como van quedando. */
  readonly rows: readonly FakeTeamRow[];
  /** Cada cambio pedido a `profiles`, aceptado o no. */
  readonly teamUpdates: FakeTeamWrite[];
  /** Cada cuenta que se pidió crear. */
  readonly createdAccounts: FakeTeamWrite[];
  /** Cada cambio pedido a una cuenta de Auth. */
  readonly accountUpdates: (FakeTeamWrite & { readonly id: string })[];
}

const ACCOUNTS_PATH = "/auth/v1/admin/users";
export const NEW_ACCOUNT_ID = "5b0c1f6e-52a4-4d4d-9d0f-3f0a9a2d7c11";
const CHECK_VIOLATION = "23514";

// Los filtros de PostgREST que usa el equipo: `eq.` e `in.(…)`.
function matches(row: FakeTeamRow, search: URLSearchParams): boolean {
  return (["id", "email", "role", "is_active"] as const).every((column) => {
    const filter = search.get(column);
    if (filter === null) return true;
    const value = String(row[column]);
    if (filter.startsWith("eq.")) return value === filter.slice(3);
    return filter.slice(4, -1).split(",").includes(value);
  });
}

function failAuth({ status, code }: FakeAccountFailure): Response {
  return Response.json(
    { code: status, error_code: code, msg: code },
    { status },
  );
}

/** `profiles` y las cuentas de Auth, de mentira, encima de `stubSupabase`.
 * Lo que la base hace de verdad se prueba en
 * `src/db/team.integration.test.ts`. */
export function stubTeamApi({
  team = [],
  lastSignIns = {},
  accountFailures = {},
  accountUpdateFailure,
  concurrentAccount,
  beforeUpdate,
  createFailure = false,
  updateRejection,
  ...options
}: FakeTeamOptions = {}): FakeTeamApi {
  const supabase = stubSupabase(options);
  const fallback = globalThis.fetch;
  const rows: FakeTeamRow[] = team.map((row) => ({ ...row }));
  const teamUpdates: FakeTeamWrite[] = [];
  const createdAccounts: FakeTeamWrite[] = [];
  const accountUpdates: FakeTeamApi["accountUpdates"] = [];

  async function answerProfiles(request: Request, url: URL): Promise<Response> {
    if (request.method !== "GET") beforeUpdate?.(rows);
    const found = rows.filter((row) => matches(row, url.searchParams));
    if (request.method === "GET") return Response.json(found);
    teamUpdates.push({
      body: await request.clone().json(),
      authorization: request.headers.get("authorization"),
    });
    if (updateRejection !== undefined) {
      return Response.json(
        { code: CHECK_VIOLATION, message: updateRejection },
        { status: 400 },
      );
    }
    const changes = (await request.json()) as Partial<FakeTeamRow>;
    for (const row of found) Object.assign(row, changes);
    return Response.json(found);
  }

  async function answerAccounts(request: Request, url: URL): Promise<Response> {
    const id = url.pathname.slice(ACCOUNTS_PATH.length + 1);
    const authorization = request.headers.get("authorization");
    if (request.method === "POST") {
      const body = (await request.json()) as { email: string };
      createdAccounts.push({ body, authorization });
      if (createFailure) {
        return failAuth({ status: 500, code: "unexpected_failure" });
      }
      if (concurrentAccount !== undefined) {
        rows.push({ ...concurrentAccount });
        return failAuth({ status: 422, code: "email_exists" });
      }
      // Como el disparador de la base: toda cuenta nace como comprador.
      rows.push({
        id: NEW_ACCOUNT_ID,
        email: body.email,
        role: "buyer",
        is_active: true,
        full_name: null,
      });
      return Response.json({ id: NEW_ACCOUNT_ID, email: body.email });
    }
    if (request.method === "PUT") {
      accountUpdates.push({ id, body: await request.json(), authorization });
      return accountUpdateFailure === undefined
        ? Response.json({ id })
        : failAuth(accountUpdateFailure);
    }
    const failure = accountFailures[id];
    if (failure !== undefined) return failAuth(failure);
    return Response.json({ id, last_sign_in_at: lastSignIns[id] ?? null });
  }

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(ACCOUNTS_PATH)) {
      return answerAccounts(request, url);
    }
    // La guardia lee el perfil propio sin pedir su `id`: ese lo contesta
    // `stubSupabase`.
    const isTeamRequest =
      url.pathname === "/rest/v1/profiles" &&
      (request.method === "PATCH" ||
        url.searchParams.get("select")?.startsWith("id") === true);
    return isTeamRequest ? answerProfiles(request, url) : fallback(request);
  }

  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      answer(new Request(input, init)),
  );
  return { ...supabase, rows, teamUpdates, createdAccounts, accountUpdates };
}
