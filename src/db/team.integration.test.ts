import { randomInt, randomUUID } from "node:crypto";
import { RouterContextProvider } from "react-router";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import type { TeamMemberView } from "~/lib/admin/team";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  type Database,
  type Transaction,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { findLink, waitForEmail } from "~/testing/local-mailbox";
import {
  createTestSession,
  deleteTestSessionUser,
  toCookieHeader,
  type TestSession,
} from "~/testing/local-session";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";

const LAST_ADMIN = /profiles_last_admin_check/;
const SITE_ORIGIN = "http://localhost:3740";
const HUMAN_DELAY_MS = 4000;
// Lo que se espera para que la segunda escritura llegue a quedar en espera.
const BLOCKING_MARGIN_MS = 500;

interface Modules {
  readonly list: typeof import("~/routes/panel/team");
  readonly invite: typeof import("~/routes/panel/team-invite");
  readonly role: typeof import("~/routes/panel/team-role");
  readonly deactivate: typeof import("~/routes/panel/team-deactivate");
  readonly activate: typeof import("~/routes/panel/team-activate");
  readonly panel: typeof import("~/lib/panel/panel-middleware.server");
  readonly session: typeof import("~/lib/supabase/session-client.server");
  readonly redeem: typeof import("~/lib/panel/redeem-sign-in-link.server");
  readonly signInForm: typeof import("~/lib/forms/admin-sign-in-form.server");
  readonly protectedForm: typeof import("~/lib/forms/protected-form.server");
  readonly fieldNames: typeof import("~/lib/forms/field-names");
  readonly turnstile: typeof import("~/lib/forms/turnstile.server");
  readonly turnstileKeys: typeof import("~/lib/forms/turnstile-test-keys");
}

async function importModules(): Promise<Modules> {
  return {
    list: await import("~/routes/panel/team"),
    invite: await import("~/routes/panel/team-invite"),
    role: await import("~/routes/panel/team-role"),
    deactivate: await import("~/routes/panel/team-deactivate"),
    activate: await import("~/routes/panel/team-activate"),
    panel: await import("~/lib/panel/panel-middleware.server"),
    session: await import("~/lib/supabase/session-client.server"),
    redeem: await import("~/lib/panel/redeem-sign-in-link.server"),
    signInForm: await import("~/lib/forms/admin-sign-in-form.server"),
    protectedForm: await import("~/lib/forms/protected-form.server"),
    fieldNames: await import("~/lib/forms/field-names"),
    turnstile: await import("~/lib/forms/turnstile.server"),
    turnstileKeys: await import("~/lib/forms/turnstile-test-keys"),
  };
}

/** Una promesa que se resuelve desde fuera. */
function createSignal(): { done: Promise<void>; fire: () => void } {
  let fire: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    fire = resolve;
  });
  return { done, fire };
}

/** Lanzarla deshace la transacción de una comprobación. */
class Rollback extends Error {}

let status: LocalSupabaseStatus;
let database: Database;
let second: Database;
let modules: Modules;
const sessionIds: string[] = [];
const invitedEmails: string[] = [];
let parkedAdmins: string[] = [];

async function signInAs(
  role: "admin" | "staff" | "buyer",
): Promise<TestSession> {
  const session = await createTestSession(status, { role });
  sessionIds.push(session.userId);
  return session;
}

interface Submission {
  readonly fields?: Record<string, string>;
  readonly memberId?: string;
}

function buildArgs<Args>(
  session: TestSession,
  { fields, memberId }: Submission = {},
): Args {
  const request = new Request(`${SITE_ORIGIN}/admin/equipo`, {
    method: fields === undefined ? "GET" : "POST",
    headers: { Cookie: toCookieHeader(session.cookies) },
    body: fields === undefined ? undefined : new URLSearchParams(fields),
  });
  const context = new RouterContextProvider();
  context.set(
    modules.panel.panelSessionContext,
    modules.session.createSessionSupabaseClient(request),
  );
  return { request, context, params: { memberId } } as unknown as Args;
}

function newEmail(): string {
  const email = `equipo-${randomUUID()}@example.com`;
  invitedEmails.push(email);
  return email;
}

function invite(
  admin: TestSession,
  email: string,
  role = "staff",
): Promise<unknown> {
  const fields = { name: "Persona invitada", email, role };
  return modules.invite.action(buildArgs(admin, { fields }));
}

function deactivate(actor: TestSession, memberId: string): Promise<unknown> {
  const fields = { confirm: "yes" };
  return modules.deactivate.action(buildArgs(actor, { fields, memberId }));
}

interface ProfileRow {
  readonly id: string;
  readonly role: string;
  readonly is_active: boolean;
  readonly full_name: string;
}

async function readProfiles(email: string): Promise<ProfileRow[]> {
  const rows = await database<ProfileRow[]>`
    select id, role, is_active, full_name from public.profiles
    where email = ${email}
  `;
  return [...rows];
}

async function countActiveAdminsAmong(ids: string[]): Promise<number> {
  const rows = await database`
    select id from public.profiles
    where role = 'admin' and is_active and id in ${database(ids)}
  `;
  return rows.length;
}

// Deja como únicos admins activos a los de la prueba. Los demás vuelven al
// terminar.
async function parkOtherAdmins(keep: string[]): Promise<void> {
  const rows = await database<{ id: string }[]>`
    update public.profiles set is_active = false
    where role = 'admin' and is_active and id not in ${database(keep)}
    returning id
  `;
  parkedAdmins = rows.map(({ id }) => id);
}

async function requestLink(email: string): Promise<void> {
  const { signInForm, protectedForm, fieldNames, turnstile } = modules;
  const { timestamp } = protectedForm.issueFormProtection(
    signInForm.ADMIN_SIGN_IN_FORM,
    { now: () => Date.now() - HUMAN_DELAY_MS },
  );
  const ip = `10.${randomInt(250)}.${randomInt(250)}.${randomInt(250)}`;
  const token = modules.turnstileKeys.TURNSTILE_TEST_KEYS.dummyToken;
  await signInForm.handleSignInRequest(
    new Request(`${SITE_ORIGIN}/admin/entrar`, {
      method: "POST",
      headers: { "X-Forwarded-For": ip },
      body: new URLSearchParams({
        email,
        [fieldNames.TIMESTAMP_FIELD]: timestamp,
        [turnstile.TURNSTILE_FIELD]: token,
      }),
    }),
  );
}

async function setUp(): Promise<void> {
  status = readLocalSupabaseStatus();
  database = connectToLocalDatabase();
  second = connectToLocalDatabase();
  // El entorno del servidor se lee al cargar sus módulos.
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  vi.stubEnv("SITE_ORIGIN", SITE_ORIGIN);
  modules = await importModules();
}

async function restoreParkedAdmins(): Promise<void> {
  if (parkedAdmins.length === 0) return;
  await database`
    update public.profiles set is_active = true
    where id in ${database(parkedAdmins)}
  `;
  parkedAdmins = [];
}

async function tearDown(): Promise<void> {
  for (const userId of sessionIds.splice(0)) {
    await deleteTestSessionUser(status, userId);
  }
  if (invitedEmails.length > 0) {
    await database`
      delete from auth.users where email in ${database(invitedEmails)}
    `;
  }
  await deleteTestUsers(database);
  await second.end();
  await database.end();
  vi.unstubAllEnvs();
}

describeIntegration("equipo: la base protege al último admin", () => {
  beforeAll(setUp);
  afterEach(restoreParkedAdmins);
  afterAll(tearDown);

  /** Con un solo admin activo, dentro de una transacción que se deshace. */
  async function asOnlyAdmin(
    work: (transaction: Transaction, adminId: string) => Promise<unknown>,
  ): Promise<void> {
    const { id } = await createTestUser(database, { role: "admin" });
    await database
      .begin(async (transaction) => {
        await transaction`
          update public.profiles set is_active = false
          where role = 'admin' and is_active and id <> ${id}
        `;
        await work(transaction, id);
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  it("rechaza desactivar al último admin activo", async () => {
    await expect(
      asOnlyAdmin(
        (transaction, id) => transaction`
          update public.profiles set is_active = false where id = ${id}`,
      ),
    ).rejects.toThrow(LAST_ADMIN);
  });

  it("rechaza pasar a staff al último admin activo", async () => {
    await expect(
      asOnlyAdmin(
        (transaction, id) => transaction`
          update public.profiles set role = 'staff' where id = ${id}`,
      ),
    ).rejects.toThrow(LAST_ADMIN);
  });

  it("rechaza dejar cero admins en una sola sentencia", async () => {
    await createTestUser(database, { role: "admin" });
    await createTestUser(database, { role: "admin" });

    await expect(
      database.begin(async (transaction) => {
        await transaction`
          update public.profiles set is_active = false where role = 'admin'`;
        throw new Rollback();
      }),
    ).rejects.toThrow(LAST_ADMIN);
  });

  it("al último admin sí le deja cambiar su nombre o seguir como está", async () => {
    await expect(
      asOnlyAdmin(
        (transaction, id) => transaction`
          update public.profiles
          set full_name = 'Única', role = 'admin', is_active = true
          where id = ${id}`,
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["desactivan", "is_active = false"],
    ["bajan de rol", "role = 'staff'"],
  ])(
    "dos admins que se %s a la vez: pasa uno y queda un admin activo",
    async (_name, assignment) => {
      const first = await createTestUser(database, { role: "admin" });
      const other = await createTestUser(database, { role: "admin" });
      await parkOtherAdmins([first.id, other.id]);
      const firstWrite = createSignal();
      const commit = createSignal();
      const write = async (
        transaction: Transaction,
        id: string,
      ): Promise<void> => {
        await transaction.unsafe(
          `update public.profiles set ${assignment} where id = $1`,
          [id],
        );
      };

      const winner = runAs(
        database,
        { kind: "signedIn", userId: first.id },
        async (transaction) => {
          await write(transaction, other.id);
          firstWrite.fire();
          await commit.done;
        },
      );
      await firstWrite.done;
      const loser = runAs(
        second,
        { kind: "signedIn", userId: other.id },
        (transaction) => write(transaction, first.id),
      );
      const rejection = expect(loser).rejects.toThrow(LAST_ADMIN);
      await new Promise((resolve) => setTimeout(resolve, BLOCKING_MARGIN_MS));
      commit.fire();

      await winner;
      await rejection;
      expect(await countActiveAdminsAmong([first.id, other.id])).toBe(1);
    },
  );

  it("desde el panel, de dos que se desactivan a la vez pasa solo una", async () => {
    const [one, two] = [await signInAs("admin"), await signInAs("admin")];
    await parkOtherAdmins([one.userId, two.userId]);

    await Promise.allSettled([
      deactivate(one, two.userId),
      deactivate(two, one.userId),
    ]);

    expect(await countActiveAdminsAmong([one.userId, two.userId])).toBe(1);
  });
});

describeIntegration("equipo: invitar y administrar", () => {
  beforeAll(setUp);
  afterAll(tearDown);

  it("un invitado pide su enlace, entra y su último ingreso aparece", async () => {
    const admin = await signInAs("admin");
    const email = newEmail();
    await invite(admin, email);
    const findInList = async (): Promise<TeamMemberView | undefined> =>
      (await modules.list.loader(buildArgs(admin))).members.find(
        (member) => member.email === email,
      );
    await expect(findInList()).resolves.toMatchObject({
      role: "staff",
      isActive: true,
      lastSignIn: null,
    });

    await requestLink(email);
    const link = findLink(await waitForEmail(email), "/admin/entrar/enlace");
    const browser = modules.session.createSessionSupabaseClient(
      new Request(SITE_ORIGIN),
    );

    await expect(
      modules.redeem.redeemSignInLink(
        browser.client,
        link.searchParams.get("token_hash") ?? "",
      ),
    ).resolves.toMatchObject({
      status: "signed_in",
      member: { email, role: "staff", fullName: "Persona invitada" },
    });
    expect((await findInList())?.lastSignIn).not.toBeNull();
  });

  it("un comprador sube de rol con la misma cuenta", async () => {
    const admin = await signInAs("admin");
    // Creado por Auth, como una cuenta de verdad: uno insertado por SQL no lo
    // conoce su API.
    const buyer = await signInAs("buyer");

    await invite(admin, ` ${buyer.email.toUpperCase()} `, "admin");

    expect(await readProfiles(buyer.email)).toEqual([
      {
        id: buyer.userId,
        role: "admin",
        is_active: true,
        full_name: "Persona invitada",
      },
    ]);
  });

  it("cada acción deja su entrada con quién y el antes y el después", async () => {
    const admin = await signInAs("admin");
    const email = newEmail();
    await invite(admin, email);
    const [profile] = await readProfiles(email);
    const memberId = profile?.id ?? "";

    await modules.role.action(
      buildArgs(admin, { fields: { role: "admin" }, memberId }),
    );
    await deactivate(admin, memberId);
    await modules.activate.action(buildArgs(admin, { fields: {}, memberId }));

    const entries = await database<{ action: string; details: unknown }[]>`
      select action, details from public.audit_log
      where actor_id = ${admin.userId} and entity_id = ${memberId}
      order by created_at
    `;
    expect(entries.map(({ action }) => action)).toEqual([
      "profile.invite",
      "profile.change_role",
      "profile.deactivate",
      "profile.activate",
    ]);
    expect(entries[1]?.details).toEqual({
      before: { role: "staff" },
      after: { role: "admin" },
    });
  });

  it("un desactivado pierde el acceso en su siguiente petición", async () => {
    const admin = await signInAs("admin");
    const staff = await signInAs("staff");
    const guard = (): Promise<unknown> => {
      const { request, context } = buildArgs<{
        request: Request;
        context: RouterContextProvider;
      }>(staff);
      const { client } = context.get(modules.panel.panelSessionContext);
      return modules.panel.verifyPanelMember(request, client);
    };
    await expect(guard()).resolves.toMatchObject({ role: "staff" });

    await deactivate(admin, staff.userId);

    await expect(guard()).rejects.toMatchObject({ status: 302 });
  });

  it.each(["staff", "buyer"] as const)(
    "un %s no lee la lista ni escribe",
    async (role) => {
      const intruder = await signInAs(role);
      const target = await createTestUser(database, { role: "staff" });
      const email = newEmail();
      const promote = buildArgs<never>(intruder, {
        fields: { role: "admin" },
        memberId: target.id,
      });

      await expect(invite(intruder, email)).rejects.toBeDefined();
      await expect(modules.role.action(promote)).rejects.toBeDefined();
      await expect(
        modules.list.loader(buildArgs(intruder)),
      ).rejects.toBeDefined();

      expect(await readProfiles(email)).toEqual([]);
      expect(await readProfiles(target.email)).toMatchObject([
        { role: "staff" },
      ]);
    },
  );
});
