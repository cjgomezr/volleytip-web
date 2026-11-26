import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { AuditPage } from "~/lib/admin/audit-log";
import type { Database as Schema } from "~/lib/database.types";
import {
  readAuditEntry,
  readAuditPage,
} from "~/lib/panel/audit-log-reader.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  takeOnlyRow,
  type Database,
  type Transaction,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTestSession,
  deleteTestSessionUser,
  type TestSession,
  type TestSessionOptions,
} from "~/testing/local-session";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";

// La bitácora no se puede limpiar: las entradas de cada corrida se reconocen
// por una acción propia.
const TEST_ACTION = `lectura.r${randomUUID().slice(0, 8)}`;
const OTHER_ACTION = `${TEST_ACTION}_otra`;
const SEEDED_ENTRIES = 10_000;
const PAGE_SIZE = 50;
const TIME_LIMIT_MS = 1000;
const PERMISSION_DENIED = /permission denied/i;

class Rollback extends Error {}

interface PlanNode {
  readonly "Node Type": string;
  readonly "Relation Name"?: string;
  readonly "Index Name"?: string;
  readonly Plans?: readonly PlanNode[];
}

interface Explained {
  readonly Plan: PlanNode;
  readonly "Execution Time": number;
}

function listNodes(node: PlanNode): readonly PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(listNodes)];
}

function signedInClient(
  status: LocalSupabaseStatus,
  { cookies }: TestSession,
): TypedSupabaseClient {
  return createServerClient<Schema>(status.API_URL, status.PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...cookies], setAll: () => undefined },
  });
}

/** El día de hoy en Colombia, como lo escribe un campo de fecha. */
function todayInColombia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

describeIntegration("lectura de la bitácora contra la base local", () => {
  let database: Database;
  let status: LocalSupabaseStatus;
  let admin: TestSession;
  let unnamed: TestSession;
  let systemEntryId: string;
  const sessions: TestSession[] = [];

  async function signIn(options: TestSessionOptions): Promise<TestSession> {
    const session = await createTestSession(status, options);
    sessions.push(session);
    return session;
  }

  async function insertEntry(
    actorId: string | null,
    action: string,
  ): Promise<string> {
    const rows = await database<{ id: string }[]>`
      insert into public.audit_log (actor_id, action, entity, details)
      values (
        ${actorId}, ${action}, 'lectura',
        '{"before": {"name": "<b>antes</b>"}, "after": {"name": "después"}}'
      )
      returning id
    `;
    return takeOnlyRow(rows, "audit_log").id;
  }

  function readAs(
    session: TestSession,
    search: Record<string, string>,
  ): Promise<AuditPage> {
    return readAuditPage(
      signedInClient(status, session),
      new URLSearchParams(search),
    );
  }

  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    database = connectToLocalDatabase();
    admin = await signIn({ role: "admin", fullName: "Autora de lectura" });
    unnamed = await signIn({ role: "admin" });
    await insertEntry(admin.userId, TEST_ACTION);
    systemEntryId = await insertEntry(null, TEST_ACTION);
    await insertEntry(unnamed.userId, TEST_ACTION);
    await insertEntry(admin.userId, OTHER_ACTION);
  });

  afterAll(async () => {
    for (const { userId } of sessions) {
      await deleteTestSessionUser(status, userId);
    }
    await deleteTestUsers(database);
    await database.end();
  });

  it("un admin lee por RLS, de la más reciente a la más antigua", async () => {
    const page = await readAs(admin, { accion: TEST_ACTION });

    expect(page.total).toBe(3);
    expect(page.entries.map(({ actorName }) => actorName)).toEqual([
      unnamed.email,
      null,
      "Autora de lectura",
    ]);
  });

  it("combina persona, acción y fechas", async () => {
    const today = todayInColombia();

    const page = await readAs(admin, {
      persona: admin.userId,
      accion: TEST_ACTION,
      desde: today,
      hasta: today,
    });

    expect(page.total).toBe(1);
    expect(page.entries[0]?.actorName).toBe("Autora de lectura");
  });

  it("un rango anterior a las entradas no trae ninguna", async () => {
    const page = await readAs(admin, {
      accion: TEST_ACTION,
      hasta: "2000-01-01",
    });

    expect(page).toMatchObject({ total: 0, entries: [] });
  });

  it("ofrece las personas y las acciones que hay en la bitácora", async () => {
    const { options } = await readAs(admin, {});

    expect(options.actions).toEqual(
      expect.arrayContaining([TEST_ACTION, OTHER_ACTION]),
    );
    expect(new Set(options.actions).size).toBe(options.actions.length);
    expect(options.actors).toContainEqual({
      id: unnamed.userId,
      name: unnamed.email,
    });
  });

  it("trae el detalle de una entrada", async () => {
    const entry = await readAuditEntry(
      signedInClient(status, admin),
      systemEntryId,
    );

    expect(entry).toMatchObject({
      actorName: null,
      action: TEST_ACTION,
      details: { before: { name: "<b>antes</b>" } },
    });
  });

  it.each(["buyer", "staff"] as const)(
    "la sesión de %s no lee nada",
    async (role) => {
      const session = await signIn({ role });

      const page = await readAs(session, { accion: TEST_ACTION });
      const entry = await readAuditEntry(
        signedInClient(status, session),
        systemEntryId,
      );

      expect(page).toMatchObject({
        total: 0,
        entries: [],
        options: { actors: [], actions: [] },
      });
      expect(entry).toBeNull();
    },
  );

  it.each(["audit_log_actors", "audit_log_actions"])(
    "sin sesión no se puede llamar %s",
    async (name) => {
      await expect(
        runAs(database, { kind: "anonymous" }, async (transaction) => {
          await transaction`select * from public.${transaction(name)}()`;
        }),
      ).rejects.toThrow(PERMISSION_DENIED);
    },
  );

  // Las 10.000 entradas se siembran en una transacción que se revierte: la
  // bitácora no deja borrarlas después. Una de cada cien es de otra persona,
  // para que filtrar por ella sea selectivo.
  async function withSeededLog(
    work: (transaction: Transaction, minorityId: string) => Promise<void>,
  ): Promise<void> {
    const reader = await createTestUser(database, { role: "admin" });
    const minority = await createTestUser(database, { role: "admin" });
    const attempt = database.begin(async (transaction) => {
      await transaction`
        insert into public.audit_log (actor_id, action, entity)
        select
          case when n % 100 = 0 then ${minority.id}::uuid
            else ${reader.id}::uuid end,
          'volumen.accion_' || (n % 20), 'volumen'
        from generate_series(1, ${SEEDED_ENTRIES}) as n
      `;
      await transaction`analyze public.audit_log`;
      const claims = JSON.stringify({ sub: reader.id, role: "authenticated" });
      await transaction`select set_config('request.jwt.claims', ${claims}, true)`;
      await transaction`select set_config('role', 'authenticated', true)`;
      await work(transaction, minority.id);
      throw new Rollback();
    });
    await expect(attempt).rejects.toBeInstanceOf(Rollback);
  }

  type ListShape = "sin filtros" | "por acción" | "por persona" | "al final";

  async function explainList(
    transaction: Transaction,
    shape: ListShape,
    minorityId: string,
  ): Promise<Explained> {
    const filters = {
      "sin filtros": transaction``,
      "al final": transaction``,
      "por acción": transaction`where entry.action = 'volumen.accion_7'`,
      "por persona": transaction`where entry.actor_id = ${minorityId}`,
    };
    const offset = shape === "al final" ? SEEDED_ENTRIES - PAGE_SIZE : 0;
    const rows = await transaction<{ "QUERY PLAN": Explained[] }[]>`
      explain (analyze, format json)
      select entry.id, entry.action, entry.entity, entry.created_at,
        actor.full_name, actor.email
      from public.audit_log as entry
      left join public.profiles as actor on actor.id = entry.actor_id
      ${filters[shape]}
      order by entry.created_at desc, entry.id desc
      limit ${PAGE_SIZE} offset ${offset}
    `;
    const [explained] = takeOnlyRow(rows, "el plan")["QUERY PLAN"];
    if (explained === undefined) throw new Error("El plan llegó vacío");
    return explained;
  }

  it.each([
    ["sin filtros", "audit_log_created_at_idx"],
    ["por acción", "audit_log_action_created_at_idx"],
    ["por persona", "audit_log_actor_created_at_idx"],
  ] as const)(
    "con 10.000 entradas, la lista %s usa su índice y responde en menos de un segundo",
    async (shape, index) => {
      await withSeededLog(async (transaction, minorityId) => {
        const explained = await explainList(transaction, shape, minorityId);

        const nodes = listNodes(explained.Plan);
        expect(nodes.map((node) => node["Index Name"])).toContain(index);
        expect(
          nodes
            .filter((node) => node["Relation Name"] === "audit_log")
            .map((node) => node["Node Type"]),
        ).not.toContain("Seq Scan");
        expect(explained["Execution Time"]).toBeLessThan(TIME_LIMIT_MS);
      });
    },
  );

  // La última página recorre casi toda la tabla: ahí el planificador puede
  // preferir leerla entera, así que solo se mide el tiempo.
  it("con 10.000 entradas, la última página responde en menos de un segundo", async () => {
    await withSeededLog(async (transaction, minorityId) => {
      const explained = await explainList(transaction, "al final", minorityId);

      expect(explained["Execution Time"]).toBeLessThan(TIME_LIMIT_MS);
    });
  });

  it("con 10.000 entradas, un admin lee por RLS todo lo de la pantalla en menos de un segundo", async () => {
    await withSeededLog(async (transaction) => {
      const startedAt = performance.now();
      await transaction`select * from public.audit_log_actors()`;
      await transaction`select * from public.audit_log_actions()`;
      const counted = await transaction<{ total: number }[]>`
        select count(*)::int as total from public.audit_log
      `;
      const rows = await transaction`
        select id from public.audit_log
        order by created_at desc, id desc limit ${PAGE_SIZE}
      `;

      expect(performance.now() - startedAt).toBeLessThan(TIME_LIMIT_MS);
      expect(rows).toHaveLength(PAGE_SIZE);
      expect(takeOnlyRow(counted, "el conteo").total).toBeGreaterThanOrEqual(
        SEEDED_ENTRIES,
      );
    });
  });
});
