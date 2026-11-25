import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { OverviewData } from "~/lib/admin/overview";
import type { Database as Schema } from "~/lib/database.types";
import { readOverview } from "~/lib/panel/overview.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import { connectToLocalDatabase, type Database } from "~/testing/database";
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

// Los datos de prueba se reconocen por este dominio y por este formulario.
const TEST_DOMAIN = "prueba-resumen.test";
const TEST_FORM = `resumen_${randomUUID().slice(0, 8)}`;

function signedInClient(
  status: LocalSupabaseStatus,
  { cookies }: TestSession,
): TypedSupabaseClient {
  return createServerClient<Schema>(status.API_URL, status.PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...cookies], setAll: () => undefined },
  });
}

describeIntegration("resumen contra la base local", () => {
  let database: Database;
  let status: LocalSupabaseStatus;
  const sessions: TestSession[] = [];

  async function signIn(options: TestSessionOptions): Promise<TestSession> {
    const session = await createTestSession(status, options);
    sessions.push(session);
    return session;
  }

  function readAs(session: TestSession): Promise<OverviewData> {
    return readOverview(signedInClient(status, session), {
      modules: [],
      now: new Date(),
    });
  }

  async function countInDatabase(): Promise<Record<string, number>> {
    const [row] = await database<
      { messages: number; app: number; camps: number }[]
    >`
      select
        (select count(*)::int from public.messages where status = 'new') as messages,
        (select count(*)::int from public.waitlists where kind = 'app') as app,
        (select count(*)::int from public.waitlists where kind = 'camp_notify') as camps
    `;
    return {
      "new-messages": row?.messages ?? -1,
      "app-waitlist": row?.app ?? -1,
      "camp-notify": row?.camps ?? -1,
    };
  }

  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    database = connectToLocalDatabase();
    await database`
      insert into public.messages (reason, name, email, body, locale, privacy_version)
      values ('other', 'Prueba', ${`${randomUUID()}@${TEST_DOMAIN}`}, 'Hola', 'es', '2026-11')
    `;
    for (const kind of ["app", "camp_notify"]) {
      await database`
        insert into public.waitlists (kind, email, locale, privacy_version)
        values (${kind}, ${`${randomUUID()}@${TEST_DOMAIN}`}, 'es', '2026-11')
      `;
    }
    await database`select public.record_form_rejection(${TEST_FORM}, 'honeypot')`;
  });

  afterAll(async () => {
    await database`delete from public.messages where email like ${`%@${TEST_DOMAIN}`}`;
    await database`delete from public.waitlists where email like ${`%@${TEST_DOMAIN}`}`;
    await database`delete from public.form_rejections where form = ${TEST_FORM}`;
    for (const { userId } of sessions) {
      await deleteTestSessionUser(status, userId);
    }
    await database.end();
  });

  // Los demás archivos de integración escriben en las mismas tablas a la vez:
  // el conteo se compara con el de la base antes y después de leer.
  it("con la sesión de un admin, las consultas pasan por RLS y cuentan lo que hay", async () => {
    const admin = await signIn({ role: "admin" });

    const before = await countInDatabase();
    const { cards } = await readAs(admin);
    const after = await countInDatabase();

    expect(cards).toHaveLength(3);
    for (const { id, count } of cards) {
      if (count.status !== "ok") throw new Error(`Falló la tarjeta ${id}`);
      const bounds = [before[id] ?? -1, after[id] ?? -1];
      expect(count.value, id).toBeGreaterThanOrEqual(Math.min(...bounds));
      expect(count.value, id).toBeLessThanOrEqual(Math.max(...bounds));
      expect(count.value, id).toBeGreaterThan(0);
    }
  });

  it("trae la actividad con su autor y los descartes de la semana", async () => {
    const admin = await signIn({ role: "admin", fullName: "Autora de prueba" });
    await database`
      insert into public.audit_log (actor_id, action, entity)
      values (${admin.userId}, 'sample.overview', 'sample')
    `;

    const { activity, rejections } = await readAs(admin);

    expect(activity.status === "ok" ? activity.value : []).toContainEqual(
      expect.objectContaining({
        action: "sample.overview",
        actorName: "Autora de prueba",
      }),
    );
    expect(rejections.status === "ok" ? rejections.value : []).toContainEqual({
      form: TEST_FORM,
      reason: "honeypot",
      count: 1,
    });
  });

  it("con la sesión de un comprador, RLS no le deja ver nada", async () => {
    const buyer = await signIn({ role: "buyer" });

    const overview = await readAs(buyer);

    expect(overview.cards.map(({ count }) => count)).toEqual(
      Array(3).fill({ status: "ok", value: 0 }),
    );
    expect(overview.activity).toEqual({ status: "ok", value: [] });
    expect(overview.rejections).toEqual({ status: "ok", value: [] });
  });
});
