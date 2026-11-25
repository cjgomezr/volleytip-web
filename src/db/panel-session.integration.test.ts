import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { identifyVisitor } from "~/lib/panel/visitor.server";
import { createAnonSupabaseClient } from "~/lib/supabase/anon-client.server";
import {
  createSessionSupabaseClient,
  type SessionSupabase,
} from "~/lib/supabase/session-client.server";
import {
  buildTestEmail,
  connectToLocalDatabase,
  type Database,
  type UserRole,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTestSession,
  deactivateTestUser,
  deleteTestSessionUser,
  toCookieHeader,
  type TestSession,
  type TestSessionOptions,
} from "~/testing/local-session";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";
import { buildTestServerEnv } from "~/testing/test-server-env";

// Los correos de prueba llevan este dominio para borrarlos sin tocar otros.
const MESSAGE_EMAIL = `${randomUUID()}@prueba-sesion.test`;
const createdUserIds: string[] = [];

let database: Database;
let status: LocalSupabaseStatus;

async function signInAs(options: TestSessionOptions): Promise<TestSession> {
  const session = await createTestSession(status, options);
  createdUserIds.push(session.userId);
  return session;
}

/** El cliente que el servidor armaría para una petición con esas cookies. */
function openRequest(cookies: TestSession["cookies"]): SessionSupabase {
  const request = new Request("http://localhost/admin", {
    headers: { Cookie: toCookieHeader(cookies) },
  });
  return createSessionSupabaseClient(
    request,
    buildTestServerEnv({
      supabaseUrl: status.API_URL,
      supabaseAnonKey: status.PUBLISHABLE_KEY,
    }),
  );
}

async function readMessagesAs(role: UserRole): Promise<unknown[]> {
  const { cookies } = await signInAs({ role });
  const { data, error } = await openRequest(cookies)
    .client.from("messages")
    .select("email")
    .eq("email", MESSAGE_EMAIL);
  expect(error).toBeNull();
  return data ?? [];
}

/** La misma sesión con el token de acceso ya vencido. */
function expireAccessToken(
  cookies: TestSession["cookies"],
): TestSession["cookies"] {
  const prefix = "base64-";
  const encoded = cookies.map(({ value }) => value).join("");
  const session = JSON.parse(
    Buffer.from(encoded.slice(prefix.length), "base64url").toString(),
  ) as Record<string, unknown>;
  const expired = { ...session, expires_at: 1 };
  const name = (cookies[0]?.name ?? "").replace(/\.0$/, "");
  return [
    {
      name,
      value: `${prefix}${Buffer.from(JSON.stringify(expired)).toString("base64url")}`,
    },
  ];
}

function readWrittenCookies(session: SessionSupabase): string[] {
  const headers = new Headers();
  session.writeCookies(headers);
  return headers.getSetCookie();
}

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterEach(async () => {
  for (const userId of createdUserIds.splice(0)) {
    await deleteTestSessionUser(status, userId);
  }
});

afterAll(async () => {
  await database.end();
});

describeIntegration("sesión del panel contra la base local", () => {
  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    await database`
      insert into public.messages (reason, name, email, body, locale, privacy_version)
      values ('other', 'Ana', ${MESSAGE_EMAIL}, 'hola', 'es', '2026-11')
    `;
  });

  afterAll(async () => {
    await database`delete from public.messages where email = ${MESSAGE_EMAIL}`;
  });

  it("un admin lee messages con el cliente de sesión", async () => {
    expect(await readMessagesAs("admin")).toEqual([{ email: MESSAGE_EMAIL }]);
  });

  it.each(["buyer", "staff"] as const)(
    "un %s no lee ningún mensaje con su sesión",
    async (role) => {
      expect(await readMessagesAs(role)).toEqual([]);
    },
  );

  it("verifica la sesión y lee el perfil de la persona", async () => {
    const { userId, email, cookies } = await signInAs({
      role: "admin",
      fullName: "Andrés Gómez",
    });

    const visitor = await identifyVisitor(openRequest(cookies).client);

    expect(visitor).toEqual({
      kind: "member",
      member: { id: userId, email, fullName: "Andrés Gómez", role: "admin" },
    });
  });

  it("un admin desactivado pierde el acceso con la sesión abierta", async () => {
    const { userId, cookies } = await signInAs({ role: "admin" });

    await deactivateTestUser(status, userId);

    expect(await identifyVisitor(openRequest(cookies).client)).toEqual({
      kind: "withoutAccess",
    });
  });

  it("renueva un token vencido y las cookies nuevas sirven", async () => {
    const { cookies } = await signInAs({ role: "admin" });
    const request = openRequest(expireAccessToken(cookies));

    const visitor = await identifyVisitor(request.client);

    expect(visitor.kind).toBe("member");
    const renewed = readWrittenCookies(request).map((cookie) => {
      const [pair = ""] = cookie.split(";");
      const [name = "", value = ""] = pair.split("=");
      return { name, value: decodeURIComponent(value) };
    });
    expect(renewed.length).toBeGreaterThan(0);
    expect(renewed).not.toEqual(cookies);
    expect((await identifyVisitor(openRequest(renewed).client)).kind).toBe(
      "member",
    );
  });

  it("cerrar sesión la invalida: las cookies viejas dejan de servir", async () => {
    const { cookies } = await signInAs({ role: "admin" });

    const { error } = await openRequest(cookies).client.auth.signOut({
      scope: "local",
    });

    expect(error).toBeNull();
    expect(await identifyVisitor(openRequest(cookies).client)).toEqual({
      kind: "withoutAccess",
    });
  });
});

describeIntegration("registro público apagado", () => {
  function countAccounts(email: string): Promise<{ total: number }[]> {
    return database<{ total: number }[]>`
      select count(*)::int as total from auth.users where email = ${email}
    `;
  }

  it("nadie crea una cuenta con correo y contraseña", async () => {
    const email = buildTestEmail();

    const { error } = await createAnonSupabaseClient().auth.signUp({
      email,
      password: randomUUID(),
    });

    expect(error?.code).toBe("signup_disabled");
    expect(await countAccounts(email)).toEqual([{ total: 0 }]);
  });

  it("pedir un enlace con un correo nuevo tampoco la crea", async () => {
    const email = buildTestEmail();

    const { error } = await createAnonSupabaseClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    expect(error).not.toBeNull();
    expect(await countAccounts(email)).toEqual([{ total: 0 }]);
  });
});
