import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { saveMessage, type MessageEntry } from "~/lib/messages.server";
import { createAnonSupabaseClient } from "~/lib/supabase/anon-client.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
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

interface MessageRow {
  readonly reason: string;
  readonly name: string;
  readonly email: string;
  readonly whatsapp: string | null;
  readonly country_code: string | null;
  readonly body: string;
  readonly payload: unknown;
  readonly locale: string;
  readonly privacy_version: string;
  readonly status: string;
  readonly answered_by: string | null;
  readonly answered_at: string | null;
}

const ANONYMOUS: Session = { kind: "anonymous" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
const PRIVACY_VERSION = "2026-11";
const MAX_BODY_LENGTH = 2000;
const MAX_NAME_LENGTH = 120;
const REASONS: readonly MessageEntry["reason"][] = [
  "order",
  "camps",
  "brands",
  "suggest_tip",
  "vball_tour",
  "other",
];
// Los correos de prueba llevan este dominio para borrarlos sin tocar otros.
const TEST_DOMAIN = "prueba-messages.test";

let database: Database;
let service: TypedSupabaseClient;
let anon: TypedSupabaseClient;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

function buildEmail(): string {
  return `${randomUUID()}@${TEST_DOMAIN}`;
}

function buildEntry(overrides: Partial<MessageEntry> = {}): MessageEntry {
  return {
    reason: "other",
    name: "Ana",
    email: buildEmail(),
    whatsapp: "+573001234567",
    countryCode: "CO",
    body: "Hola, quiero saber más.",
    payload: { orderNumber: "A-1" },
    locale: "es",
    privacyVersion: PRIVACY_VERSION,
    ...overrides,
  };
}

/** Llama a la función de Postgres sin la capa de TypeScript, para probar lo
 * que la base rechaza (por ejemplo un `payload` que no es objeto). */
async function callSave(
  entry: MessageEntry,
  payload: unknown = entry.payload,
): Promise<void> {
  const { error } = await service.rpc("save_message", {
    p_reason: entry.reason,
    p_name: entry.name,
    p_email: entry.email,
    p_whatsapp: entry.whatsapp ?? undefined,
    p_country_code: entry.countryCode ?? undefined,
    p_body: entry.body,
    p_payload: payload as never,
    p_locale: entry.locale,
    p_privacy_version: entry.privacyVersion,
  });
  if (error !== null) {
    throw new Error(error.message);
  }
}

function readRows(email: string): Promise<MessageRow[]> {
  return database<MessageRow[]>`
    select reason, name, email, whatsapp, country_code, body, payload, locale,
      privacy_version, status, answered_by, answered_at
    from public.messages where email = ${email}
  `;
}

async function seed(): Promise<string> {
  const entry = buildEntry();
  await saveMessage(entry, service);
  return entry.email;
}

function insertAs(session: Session): Promise<unknown> {
  return runAs(
    database,
    session,
    (transaction) => transaction`
      insert into public.messages (reason, name, email, body, locale, privacy_version)
      values ('other', 'Ana', ${buildEmail()}, 'hola', 'es', ${PRIVACY_VERSION})
    `,
  );
}

function archiveAllAs(session: Session): Promise<unknown> {
  return runAs(
    database,
    session,
    (transaction) =>
      transaction`update public.messages set status = 'archived'`,
  );
}

beforeAll(() => {
  database = connectToLocalDatabase();
  service = createLocalServiceClient();
  anon = createAnonSupabaseClient();
});

afterEach(async () => {
  await database`delete from public.messages where email like ${`%@${TEST_DOMAIN}`}`;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

describeIntegration("messages: guardar", () => {
  it.each(REASONS)("guarda un mensaje válido con motivo %s", async (reason) => {
    const entry = buildEntry({ reason });

    await saveMessage(entry, service);

    expect(await readRows(entry.email)).toEqual([
      {
        reason,
        name: "Ana",
        email: entry.email,
        whatsapp: "+573001234567",
        country_code: "CO",
        body: "Hola, quiero saber más.",
        payload: { orderNumber: "A-1" },
        locale: "es",
        privacy_version: PRIVACY_VERSION,
        status: "new",
        answered_by: null,
        answered_at: null,
      },
    ]);
  });

  it("acepta el WhatsApp y el país ausentes", async () => {
    const entry = buildEntry({ whatsapp: null, countryCode: null });

    await saveMessage(entry, service);

    expect(await readRows(entry.email)).toMatchObject([
      { whatsapp: null, country_code: null },
    ]);
  });

  it("guarda el correo en minúsculas y sin espacios", async () => {
    const email = buildEmail();

    await saveMessage(
      buildEntry({ email: `  ${email.toUpperCase()}  ` }),
      service,
    );

    expect(await readRows(email)).toHaveLength(1);
  });

  it("acepta un cuerpo de 2.000 caracteres y un nombre de 120", async () => {
    const entry = buildEntry({
      body: "a".repeat(MAX_BODY_LENGTH),
      name: "n".repeat(MAX_NAME_LENGTH),
    });

    await expect(saveMessage(entry, service)).resolves.toBeUndefined();
  });

  it("guarda el texto sin interpretarlo", async () => {
    const entry = buildEntry({ body: "<script>alert(1)</script>" });

    await saveMessage(entry, service);

    expect(await readRows(entry.email)).toMatchObject([
      { body: "<script>alert(1)</script>" },
    ]);
  });

  it("rechaza un motivo que no existe", async () => {
    await expect(
      callSave(buildEntry({ reason: "otro" as MessageEntry["reason"] })),
    ).rejects.toThrow(/messages_reason_check/);
  });

  it.each(["name", "email", "body"] as const)(
    "rechaza %s de solo espacios",
    async (field) => {
      await expect(callSave(buildEntry({ [field]: "   " }))).rejects.toThrow(
        new RegExp(`messages_${field}_check`),
      );
    },
  );

  it.each(["name", "email", "body"] as const)(
    "rechaza %s vacío",
    async (field) => {
      await expect(callSave(buildEntry({ [field]: "" }))).rejects.toThrow(
        new RegExp(`messages_${field}_check`),
      );
    },
  );

  it("rechaza un cuerpo de más de 2.000 caracteres", async () => {
    await expect(
      callSave(buildEntry({ body: "a".repeat(MAX_BODY_LENGTH + 1) })),
    ).rejects.toThrow(/messages_body_check/);
  });

  it("rechaza un nombre de más de 120 caracteres", async () => {
    await expect(
      callSave(buildEntry({ name: "n".repeat(MAX_NAME_LENGTH + 1) })),
    ).rejects.toThrow(/messages_name_check/);
  });

  it.each([[[1, 2]], ["texto"], [3]])(
    "rechaza un payload que no es objeto (%j)",
    async (payload) => {
      await expect(callSave(buildEntry(), payload)).rejects.toThrow(
        /messages_payload_check/,
      );
    },
  );

  it("rechaza un idioma que no existe en languages", async () => {
    await expect(callSave(buildEntry({ locale: "zz" }))).rejects.toThrow(
      /messages_locale_fkey/,
    );
  });

  it.each(["co", "COL", "C", "C1"])(
    "rechaza el país %s",
    async (countryCode) => {
      await expect(callSave(buildEntry({ countryCode }))).rejects.toThrow(
        /messages_country_code_check/,
      );
    },
  );

  it("rechaza una versión de privacidad vacía", async () => {
    await expect(
      callSave(buildEntry({ privacyVersion: "  " })),
    ).rejects.toThrow(/messages_privacy_version_check/);
  });

  it("rechaza un answered_by que no es un perfil", async () => {
    const email = await seed();

    await expect(
      database`update public.messages set answered_by = ${randomUUID()} where email = ${email}`,
    ).rejects.toThrow(/messages_answered_by_fkey/);
  });
});

describeIntegration("messages: permisos", () => {
  it("el anónimo con la llave pública no lee filas", async () => {
    const email = await seed();

    const { data, error } = await anon
      .from("messages")
      .select("email")
      .eq("email", email);

    expect(error === null ? data : []).toEqual([]);
  });

  it("el anónimo no inserta, no cambia y no borra", async () => {
    await seed();

    await expect(insertAs(ANONYMOUS)).rejects.toThrow(PERMISSION_DENIED);
    await expect(archiveAllAs(ANONYMOUS)).rejects.toThrow(PERMISSION_DENIED);
    await expect(
      runAs(
        database,
        ANONYMOUS,
        (transaction) => transaction`delete from public.messages`,
      ),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  it("el anónimo no ejecuta la función de Postgres", async () => {
    await expect(
      runAs(
        database,
        ANONYMOUS,
        (transaction) => transaction`
          select public.save_message('other', 'Ana', ${buildEmail()}, 'hola', 'es', ${PRIVACY_VERSION})
        `,
      ),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  it("el comprador con sesión no lee ni escribe", async () => {
    const session = signedInAs(
      await createTestUser(database, { role: "buyer" }),
    );
    const email = await seed();

    const rows = await runAs(
      database,
      session,
      (transaction) =>
        transaction`select email from public.messages where email = ${email}`,
    );

    expect(rows).toEqual([]);
    await expect(insertAs(session)).rejects.toThrow(PERMISSION_DENIED);
    await expect(archiveAllAs(session)).resolves.toBeDefined();
    expect(await readRows(email)).toMatchObject([{ status: "new" }]);
  });

  it("el admin lee los mensajes", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const email = await seed();

    const rows = await runAs(
      database,
      signedInAs(admin),
      (transaction) =>
        transaction`select email from public.messages where email = ${email}`,
    );

    expect(rows).toHaveLength(1);
  });

  it("el admin cambia el estado y quién respondió", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const email = await seed();

    await runAs(
      database,
      signedInAs(admin),
      (transaction) => transaction`
        update public.messages
        set status = 'answered', answered_by = ${admin.id}, answered_at = now()
        where email = ${email}
      `,
    );

    expect(await readRows(email)).toMatchObject([
      { status: "answered", answered_by: admin.id },
    ]);
  });

  it("el admin no inserta ni reescribe lo que escribió la persona", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const email = await seed();

    await expect(insertAs(signedInAs(admin))).rejects.toThrow(
      PERMISSION_DENIED,
    );
    await expect(
      runAs(
        database,
        signedInAs(admin),
        (transaction) =>
          transaction`update public.messages set body = 'otro' where email = ${email}`,
      ),
    ).rejects.toThrow(PERMISSION_DENIED);
  });
});
