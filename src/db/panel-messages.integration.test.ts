import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { RouterContextProvider, type ActionFunctionArgs } from "react-router";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import type { InboxQuery } from "~/lib/admin/messages";
import type { Database as Schema } from "~/lib/database.types";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import {
  connectToLocalDatabase,
  runAs,
  type Database,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTestSession,
  deleteTestSessionUser,
  toCookieHeader,
  type TestSession,
  type TestSessionOptions,
} from "~/testing/local-session";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";

// Los mensajes de prueba se reconocen por este dominio: la búsqueda se limita
// a él porque otros archivos escriben en la misma tabla a la vez.
const TEST_DOMAIN = `bandeja-${randomUUID().slice(0, 8)}.test`;
const SEEDED = 1000;
const PAGE_SIZE = 50;
const ONE_SECOND = 1000;
const BODY = "Cuerpo que la bitácora no debe guardar";
const NO_FILTERS: InboxQuery = {
  reason: null,
  status: null,
  search: "",
  page: 1,
};
const SCOPED: InboxQuery = { ...NO_FILTERS, search: TEST_DOMAIN };

type Modules = {
  readonly inbox: typeof import("~/lib/panel/messages-inbox.server");
  readonly panel: typeof import("~/lib/panel/panel-middleware.server");
  readonly session: typeof import("~/lib/supabase/session-client.server");
  readonly answer: typeof import("~/routes/panel/message-answer");
  readonly archive: typeof import("~/routes/panel/message-archive");
  readonly reopen: typeof import("~/routes/panel/message-reopen");
};

// El entorno del servidor se lee al cargar sus módulos: se importan después
// de apuntar las variables a la base local.
async function loadModules(status: LocalSupabaseStatus): Promise<Modules> {
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  return {
    inbox: await import("~/lib/panel/messages-inbox.server"),
    panel: await import("~/lib/panel/panel-middleware.server"),
    session: await import("~/lib/supabase/session-client.server"),
    answer: await import("~/routes/panel/message-answer"),
    archive: await import("~/routes/panel/message-archive"),
    reopen: await import("~/routes/panel/message-reopen"),
  };
}

interface StateRow {
  readonly status: string;
  readonly answered_by: string | null;
  readonly answered_at: Date | null;
}

describeIntegration("bandeja contra la base local", () => {
  let database: Database;
  let status: LocalSupabaseStatus;
  let modules: Modules;
  let admin: TestSession;
  const sessions: TestSession[] = [];

  async function signIn(options: TestSessionOptions): Promise<TestSession> {
    const session = await createTestSession(status, options);
    sessions.push(session);
    return session;
  }

  function clientOf({ cookies }: TestSession): TypedSupabaseClient {
    return createServerClient<Schema>(status.API_URL, status.PUBLISHABLE_KEY, {
      cookies: { getAll: () => [...cookies], setAll: () => undefined },
    });
  }

  async function insertMessage(
    name: string,
    email = `${randomUUID()}@${TEST_DOMAIN}`,
  ): Promise<string> {
    const [row] = await database<{ id: string }[]>`
      insert into public.messages
        (reason, name, email, body, locale, privacy_version)
      values ('other', ${name}, ${email}, ${BODY}, 'es', '2026-11')
      returning id
    `;
    return row?.id ?? "";
  }

  async function readState(id: string): Promise<StateRow | undefined> {
    const [row] = await database<StateRow[]>`
      select status, answered_by, answered_at from public.messages
      where id = ${id}
    `;
    return row;
  }

  // La acción detrás de la guardia, como en el sitio.
  async function submit(
    verb: "answer" | "archive" | "reopen",
    id: string,
    { cookies }: TestSession = admin,
  ): Promise<unknown> {
    const request = new Request(`http://localhost/admin/mensajes/${id}/x`, {
      method: "POST",
      headers: { Cookie: toCookieHeader(cookies) },
      body: new URLSearchParams(),
    });
    const context = new RouterContextProvider();
    context.set(
      modules.panel.panelSessionContext,
      modules.session.createSessionSupabaseClient(request),
    );
    const args = {
      request,
      context,
      params: { messageId: id },
    } as unknown as ActionFunctionArgs;
    await modules.panel.requirePanelMember(args, () =>
      Promise.resolve(new Response()),
    );
    const action: (given: typeof args) => Promise<unknown> = modules[verb]
      .action as unknown as typeof action;
    return action(args);
  }

  /** El plan de una consulta, pedido con la sesión de un admin. */
  async function explain(
    query: string,
    { isSeqScanAllowed = true } = {},
  ): Promise<string> {
    // El plan sale de las estadísticas: se recalculan justo antes de pedirlo.
    await database`analyze public.messages`;
    return runAs(
      database,
      { kind: "signedIn", userId: admin.userId },
      async (transaction) => {
        if (!isSeqScanAllowed) {
          await transaction`select set_config('enable_seqscan', 'off', true)`;
        }
        const rows = await transaction.unsafe(`explain ${query}`);
        return rows.map((row) => String(row["QUERY PLAN"])).join("\n");
      },
    );
  }

  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    database = connectToLocalDatabase();
    modules = await loadModules(status);
    admin = await signIn({ role: "admin" });
    // El 1 es el más reciente. Uno de cada diez es de pedidos. Los nuevos y
    // los respondidos son uno de cada cien, como en una bandeja al día: raros
    // como para que filtrar por ellos pida su índice.
    await database`
      insert into public.messages
        (reason, name, email, body, locale, privacy_version, status, created_at)
      select
        case when n % 10 = 0 then 'order' else 'other' end,
        'Persona ' || lpad(n::text, 4, '0'),
        'p' || lpad(n::text, 4, '0') || ${`@${TEST_DOMAIN}`},
        'Hola', 'es', '2026-11',
        (case
          when n % 100 = 0 then 'new'
          when n % 100 = 1 then 'answered'
          else 'archived'
        end)::public.message_status,
        now() - make_interval(mins => n)
      from generate_series(1, ${SEEDED}) as n
    `;
  });

  afterAll(async () => {
    await database`delete from public.messages where email like ${`%${TEST_DOMAIN}`}`;
    for (const { userId } of sessions) {
      await deleteTestSessionUser(status, userId);
    }
    await database.end();
    vi.unstubAllEnvs();
  });

  it("lista del más reciente al más antiguo, de 50 en 50", async () => {
    const client = clientOf(admin);

    const first = await modules.inbox.readInbox(client, SCOPED);
    const second = await modules.inbox.readInbox(client, {
      ...SCOPED,
      page: 2,
    });

    expect(first).toMatchObject({ total: SEEDED, pageCount: 20, page: 1 });
    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.rows[0]?.name).toBe("Persona 0001");
    expect(first.rows[49]?.name).toBe("Persona 0050");
    expect(second.rows[0]?.name).toBe("Persona 0051");
  });

  it("con 1.000 mensajes responde en menos de un segundo (NFR-002)", async () => {
    const client = clientOf(admin);
    const started = performance.now();

    await modules.inbox.readInbox(client, { ...NO_FILTERS, page: 20 });
    await modules.inbox.readInbox(client, { ...SCOPED, status: "new" });

    expect(performance.now() - started).toBeLessThan(ONE_SECOND);
  });

  const LIST =
    "select id, name, reason, status, created_at from public.messages";
  const NEWEST_PAGE = "order by created_at desc, id desc limit 50";

  it.each([
    ["la lista", `${LIST} ${NEWEST_PAGE}`, "messages_created_at_idx"],
    [
      "la lista por estado",
      `${LIST} where status = 'answered' ${NEWEST_PAGE}`,
      "messages_answered_idx",
    ],
  ])("%s usa su índice", async (_, query, index) => {
    const plan = await explain(query);

    expect(plan).toContain(index);
    expect(plan).not.toContain("Seq Scan on messages");
  });

  // Con 1.000 filas, contar leyendo la tabla entera le sale más barato a
  // Postgres. Sin esa salida se ve qué índice le sirve cuando la tabla crezca.
  it("el conteo de nuevos del menú tiene un índice que le sirve", async () => {
    const plan = await explain(
      "select count(*) from public.messages where status = 'new'",
      { isSeqScanAllowed: false },
    );

    expect(plan).toContain("messages_new_idx");
  });

  it("la sesión de un admin no puede borrar un mensaje", async () => {
    const id = await insertMessage("Sin borrar");

    const { error } = await clientOf(admin)
      .from("messages")
      .delete()
      .eq("id", id);

    expect(error?.message).toMatch(/permission denied/i);
    expect(await readState(id)).toBeDefined();
  });

  it("combina motivo, estado y búsqueda", async () => {
    const page = await modules.inbox.readInbox(clientOf(admin), {
      reason: "order",
      status: "new",
      search: TEST_DOMAIN,
      page: 1,
    });

    expect(page.total).toBe(SEEDED / 100);
    expect(page.rows[0]?.name).toBe("Persona 0100");
  });

  it.each([
    ["por nombre, sin importar mayúsculas", "pERSONA 0042"],
    ["por correo", `p0042@${TEST_DOMAIN}`],
  ])("busca %s", async (_, search) => {
    const page = await modules.inbox.readInbox(clientOf(admin), {
      ...NO_FILTERS,
      search,
    });

    // Otros archivos pueden sembrar "Persona": se mira el de esta corrida.
    expect(page.rows.map(({ email }) => email)).toContain(
      `p0042@${TEST_DOMAIN}`,
    );
  });

  it.each([
    "50% de_descuento",
    'Ana "la capitana" (Cali), Co.',
    "barra \\ invertida",
    "estrella * suelta",
  ])("encuentra %s como texto", async (name) => {
    const id = await insertMessage(`${TEST_DOMAIN} ${name}`);

    const page = await modules.inbox.readInbox(clientOf(admin), {
      ...NO_FILTERS,
      search: `${TEST_DOMAIN} ${name}`,
    });

    expect(page.rows.map((row) => row.id)).toEqual([id]);
    await database`delete from public.messages where id = ${id}`;
  });

  it("un comodín escrito en la búsqueda no coincide con todo", async () => {
    const page = await modules.inbox.readInbox(clientOf(admin), {
      ...NO_FILTERS,
      search: `%%%${TEST_DOMAIN}`,
    });

    expect(page.total).toBe(0);
  });

  it("la sesión de un admin cambia el estado por RLS y queda en la bitácora sin el cuerpo", async () => {
    const id = await insertMessage("Estados");

    await submit("answer", id);
    const answered = await readState(id);
    await submit("archive", id);
    await submit("reopen", id);

    expect(answered).toMatchObject({
      status: "answered",
      answered_by: admin.userId,
      answered_at: expect.any(Date),
    });
    expect(await readState(id)).toMatchObject({
      status: "answered",
      answered_by: admin.userId,
    });
    const entries = await database<{ action: string; details: unknown }[]>`
      select action, details from public.audit_log
      where entity_id = ${id} order by created_at
    `;
    expect(entries.map(({ action, details }) => [action, details])).toEqual([
      [
        "message.answer",
        { before: { status: "new" }, after: { status: "answered" } },
      ],
      [
        "message.archive",
        { before: { status: "answered" }, after: { status: "archived" } },
      ],
      [
        "message.reopen",
        { before: { status: "archived" }, after: { status: "answered" } },
      ],
    ]);
    expect(JSON.stringify(entries)).not.toContain(BODY);
  });

  it("el detalle trae quién respondió", async () => {
    const id = await insertMessage("Detalle");
    await submit("answer", id);

    const message = await modules.inbox.readMessage(clientOf(admin), id);

    expect(message?.answerer?.email).toBe(admin.email);
  });

  it.each(["buyer", "staff"] as const)(
    "la sesión de un %s no lee ni cambia nada",
    async (role) => {
      const session = await signIn({ role });
      const id = await insertMessage(`Ajeno ${role}`);
      const client = clientOf(session);

      const page = await modules.inbox.readInbox(client, SCOPED);
      const message = await modules.inbox.readMessage(client, id);
      const update = await client
        .from("messages")
        .update({ status: "archived" })
        .eq("id", id)
        .select("id");
      await expect(submit("answer", id, session)).rejects.toBeDefined();

      expect(page).toMatchObject({ total: 0, rows: [] });
      expect(message).toBeNull();
      expect(update.data ?? []).toEqual([]);
      expect(await readState(id)).toMatchObject({ status: "new" });
    },
  );
});
