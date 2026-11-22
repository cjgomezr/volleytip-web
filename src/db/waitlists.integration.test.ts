import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { createAnonSupabaseClient } from "~/lib/supabase/anon-client.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import { joinWaitlist, type WaitlistEntry } from "~/lib/waitlists.server";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  type Database,
  type Session,
  type TestUser,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createLocalServiceClient } from "~/testing/local-supabase.server";

interface WaitlistRow {
  readonly kind: string;
  readonly email: string;
  readonly locale: string;
  readonly country_code: string | null;
  readonly city: string | null;
  readonly privacy_version: string;
  readonly notified_at: string | null;
}

const ANONYMOUS: Session = { kind: "anonymous" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
const PRIVACY_VERSION = "2026-11";
const SIMULTANEOUS_CALLS = 10;
// Los correos de prueba llevan este dominio para borrarlos sin tocar otros.
const TEST_DOMAIN = "prueba-waitlists.test";

let database: Database;
let service: TypedSupabaseClient;
let anon: TypedSupabaseClient;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

function buildEmail(): string {
  return `${randomUUID()}@${TEST_DOMAIN}`;
}

function buildEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    kind: "app",
    email: buildEmail(),
    locale: "es",
    countryCode: "CO",
    city: "Medellín",
    privacyVersion: PRIVACY_VERSION,
    ...overrides,
  };
}

/** Llama a la función de Postgres sin la capa de TypeScript, para probar lo
 * que la base rechaza. */
async function callEnroll(entry: WaitlistEntry): Promise<void> {
  const { error } = await service.rpc("enroll_waitlist", {
    p_kind: entry.kind,
    p_email: entry.email,
    p_locale: entry.locale,
    p_country_code: entry.countryCode ?? undefined,
    p_city: entry.city ?? undefined,
    p_privacy_version: entry.privacyVersion,
  });
  if (error !== null) {
    throw new Error(error.message);
  }
}

function readRows(email: string): Promise<WaitlistRow[]> {
  return database<WaitlistRow[]>`
    select kind, email, locale, country_code, city, privacy_version, notified_at
    from public.waitlists where lower(btrim(email)) = lower(btrim(${email}))
    order by kind
  `;
}

async function seed(): Promise<string> {
  const entry = buildEntry();
  await joinWaitlist(entry, service);
  return entry.email;
}

function insertAs(session: Session): Promise<unknown> {
  return runAs(
    database,
    session,
    (transaction) => transaction`
      insert into public.waitlists (kind, email, locale, privacy_version)
      values ('app', ${buildEmail()}, 'es', ${PRIVACY_VERSION})
    `,
  );
}

function enrollAs(session: Session): Promise<unknown> {
  return runAs(
    database,
    session,
    (transaction) => transaction`
      select public.enroll_waitlist('app', ${buildEmail()}, 'es', ${PRIVACY_VERSION}, 'CO', null)
    `,
  );
}

beforeAll(() => {
  database = connectToLocalDatabase();
  service = createLocalServiceClient();
  anon = createAnonSupabaseClient();
});

afterEach(async () => {
  await database`delete from public.waitlists where email like ${`%@${TEST_DOMAIN}`}`;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

describeIntegration("waitlists: inscribir", () => {
  it("guarda una fila con los datos recibidos y la versión de privacidad", async () => {
    const entry = buildEntry();

    await joinWaitlist(entry, service);

    expect(await readRows(entry.email)).toEqual([
      {
        kind: "app",
        email: entry.email,
        locale: "es",
        country_code: "CO",
        city: "Medellín",
        privacy_version: PRIVACY_VERSION,
        notified_at: null,
      },
    ]);
  });

  it("acepta la ciudad ausente", async () => {
    const entry = buildEntry({ city: null });

    await joinWaitlist(entry, service);

    expect(await readRows(entry.email)).toMatchObject([{ city: null }]);
  });

  it("no falla ni duplica con un correo ya inscrito en ese tipo", async () => {
    const entry = buildEntry();
    await joinWaitlist(entry, service);

    await expect(joinWaitlist(entry, service)).resolves.toBeUndefined();

    expect(await readRows(entry.email)).toHaveLength(1);
  });

  it("no cambia la fila existente al inscribir otra vez", async () => {
    const entry = buildEntry();
    await joinWaitlist(entry, service);
    const before = await readRows(entry.email);

    await joinWaitlist(
      {
        ...entry,
        locale: "en",
        countryCode: "US",
        city: "Austin",
        privacyVersion: "2027-01",
      },
      service,
    );

    expect(await readRows(entry.email)).toEqual(before);
  });

  it("guarda dos filas con el mismo correo en app y en camp_notify", async () => {
    const entry = buildEntry();

    await joinWaitlist(entry, service);
    await joinWaitlist({ ...entry, kind: "camp_notify" }, service);

    expect(await readRows(entry.email)).toMatchObject([
      { kind: "app" },
      { kind: "camp_notify" },
    ]);
  });

  it("guarda el correo en minúsculas y sin espacios, y cuenta como el mismo", async () => {
    const email = buildEmail();
    await joinWaitlist(
      buildEntry({ email: `  ${email.toUpperCase()}  ` }),
      service,
    );

    await joinWaitlist(buildEntry({ email }), service);

    expect(await readRows(email)).toMatchObject([{ email }]);
  });

  it("acepta el país ausente", async () => {
    const entry = buildEntry({ countryCode: null });

    await joinWaitlist(entry, service);

    expect(await readRows(entry.email)).toMatchObject([{ country_code: null }]);
  });

  it.each(["co", "COL", "C", "C1"])(
    "rechaza el país %s",
    async (countryCode) => {
      await expect(callEnroll(buildEntry({ countryCode }))).rejects.toThrow(
        /waitlists_country_code_check/,
      );
    },
  );

  it("rechaza un tipo que no existe", async () => {
    await expect(
      callEnroll(buildEntry({ kind: "otro" as WaitlistEntry["kind"] })),
    ).rejects.toThrow(/waitlists_kind_check/);
  });

  it("rechaza un idioma que no existe en languages", async () => {
    await expect(callEnroll(buildEntry({ locale: "zz" }))).rejects.toThrow(
      /waitlists_locale_fkey/,
    );
  });

  it("rechaza una versión de privacidad vacía", async () => {
    await expect(
      callEnroll(buildEntry({ privacyVersion: "  " })),
    ).rejects.toThrow(/waitlists_privacy_version_check/);
  });

  it("rechaza un correo vacío", async () => {
    await expect(callEnroll(buildEntry({ email: "   " }))).rejects.toThrow(
      /waitlists_email_check/,
    );
  });
});

describeIntegration("waitlists: concurrencia", () => {
  it("varias inscripciones a la vez dejan una fila y ninguna falla", async () => {
    const entry = buildEntry();

    await Promise.all(
      Array.from({ length: SIMULTANEOUS_CALLS }, () =>
        joinWaitlist(entry, service),
      ),
    );

    expect(await readRows(entry.email)).toHaveLength(1);
  });
});

describeIntegration("waitlists: permisos", () => {
  it("el anónimo con la llave pública no lee filas", async () => {
    const email = await seed();

    const { data, error } = await anon
      .from("waitlists")
      .select("email")
      .eq("email", email);

    expect(error === null ? data : []).toEqual([]);
  });

  it("el anónimo no inserta", async () => {
    await expect(insertAs(ANONYMOUS)).rejects.toThrow(PERMISSION_DENIED);
  });

  it("el anónimo no cambia", async () => {
    await seed();

    await expect(
      runAs(
        database,
        ANONYMOUS,
        (transaction) => transaction`update public.waitlists set city = 'x'`,
      ),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  it("el anónimo no borra", async () => {
    await seed();

    await expect(
      runAs(
        database,
        ANONYMOUS,
        (transaction) => transaction`delete from public.waitlists`,
      ),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  it("el anónimo no ejecuta la función de Postgres", async () => {
    await expect(enrollAs(ANONYMOUS)).rejects.toThrow(PERMISSION_DENIED);
  });

  it("el comprador con sesión no lee", async () => {
    const buyer = await createTestUser(database, { role: "buyer" });
    const email = await seed();

    const rows = await runAs(
      database,
      signedInAs(buyer),
      (transaction) =>
        transaction`select email from public.waitlists where email = ${email}`,
    );

    expect(rows).toEqual([]);
  });

  it("el comprador con sesión no inserta ni ejecuta la función", async () => {
    const session = signedInAs(
      await createTestUser(database, { role: "buyer" }),
    );

    await expect(insertAs(session)).rejects.toThrow(PERMISSION_DENIED);
    await expect(enrollAs(session)).rejects.toThrow(PERMISSION_DENIED);
  });

  it("el admin lee la tabla", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const email = await seed();

    const rows = await runAs(
      database,
      signedInAs(admin),
      (transaction) =>
        transaction`select email from public.waitlists where email = ${email}`,
    );

    expect(rows).toHaveLength(1);
  });

  it("el admin no escribe directamente", async () => {
    const admin = await createTestUser(database, { role: "admin" });

    await expect(insertAs(signedInAs(admin))).rejects.toThrow(
      PERMISSION_DENIED,
    );
  });
});
