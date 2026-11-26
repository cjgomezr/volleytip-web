import { RouterContextProvider, type ActionFunctionArgs } from "react-router";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTestSession,
  toCookieHeader,
  type TestSession,
} from "~/testing/local-session";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";

type Modules = typeof import("~/lib/panel/panel-middleware.server") &
  typeof import("~/lib/panel/site-texts-editor.server") &
  typeof import("~/lib/supabase/session-client.server") &
  typeof import("~/lib/site-settings.server") &
  typeof import("~/lib/announcement-bar.server") &
  typeof import("~/lib/site-stats.server") & {
    readonly saveBar: (args: ActionFunctionArgs) => Promise<unknown>;
    readonly saveStats: (args: ActionFunctionArgs) => Promise<unknown>;
  };

// El entorno del servidor se lee al cargar sus módulos: se importan después
// de apuntar las variables a la base local.
async function loadModules(status: LocalSupabaseStatus): Promise<Modules> {
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  return {
    saveBar: (await import("~/routes/panel/site-texts-announcements")).action,
    saveStats: (await import("~/routes/panel/site-texts-stats")).action,
    ...(await import("~/lib/panel/panel-middleware.server")),
    ...(await import("~/lib/panel/site-texts-editor.server")),
    ...(await import("~/lib/supabase/session-client.server")),
    ...(await import("~/lib/site-settings.server")),
    ...(await import("~/lib/announcement-bar.server")),
    ...(await import("~/lib/site-stats.server")),
  };
}

type Fields = [string, string][];

interface StoredText {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
}

const BAR_KEY = "announcement_bar";
const TOUCHED_STATS = "stats.instagram.%";

describeIntegration("textos del sitio contra la base local", () => {
  let database: Database;
  let status: LocalSupabaseStatus;
  let modules: Modules;
  let originalBar: string | undefined;
  let originalStats: StoredText[] = [];

  function buildArgs(
    { cookies }: TestSession,
    fields: Fields,
  ): ActionFunctionArgs {
    const request = new Request("http://localhost/admin/textos", {
      method: "POST",
      headers: { Cookie: toCookieHeader(cookies) },
      body: new URLSearchParams(fields),
    });
    const context = new RouterContextProvider();
    context.set(
      modules.panelSessionContext,
      modules.createSessionSupabaseClient(request),
    );
    return { request, context, params: {} } as unknown as ActionFunctionArgs;
  }

  function sessionClient(session: TestSession): TypedSupabaseClient {
    return modules.createSessionSupabaseClient(buildArgs(session, []).request)
      .client;
  }

  /** El formulario de las cifras con lo guardado, salvo lo que se cambie. */
  async function statFields(
    session: TestSession,
    changes: Record<string, string>,
  ): Promise<Fields> {
    const { stats } = await modules.readSiteTextsEditor(sessionClient(session));
    return stats.flatMap(({ id, value, label }) =>
      Object.entries({ value, label }).flatMap(([part, texts]) =>
        Object.entries(texts).map(([locale, text]): Fields[number] => {
          const name = `stats.${id}.${part}:${locale}`;
          return [name, changes[name] ?? text];
        }),
      ),
    );
  }

  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    modules = await loadModules(status);
    database = connectToLocalDatabase();
    const [bar] = await database<{ value: string }[]>`
      select value::text as value from public.settings where key = ${BAR_KEY}`;
    originalBar = bar?.value;
    originalStats = [
      ...(await database<StoredText[]>`
        select key, locale, value from public.site_texts
        where key like ${TOUCHED_STATS}`),
    ];
  });

  // Deja la base como estaba: otras pruebas leen la barra y las cifras. El
  // admin se queda porque `audit_log` no deja borrar al autor de una entrada.
  afterAll(async () => {
    await database`delete from public.settings where key = ${BAR_KEY}`;
    if (originalBar !== undefined) {
      await database`
        insert into public.settings (key, value)
        values (${BAR_KEY}, ${originalBar}::text::jsonb)`;
    }
    for (const { key, locale, value } of originalStats) {
      await database`
        update public.site_texts set value = ${value}
        where key = ${key} and locale = ${locale}`;
    }
    vi.unstubAllEnvs();
    await database.end();
  });

  it("lo que guarda un admin lo leen las funciones públicas del sitio", async () => {
    const admin = await createTestSession(status, { role: "admin" });

    await modules.saveBar(
      buildArgs(admin, [
        ["messageCount", "1"],
        ["es", "Aviso de integración"],
        ["en", "Integration notice"],
      ]),
    );
    await modules.saveStats(
      buildArgs(
        admin,
        await statFields(admin, {
          "stats.instagram.value:es": "999K",
          "stats.instagram.value:en": "999K",
        }),
      ),
    );

    const { announcements } = await modules.loadSiteSettings();
    expect(modules.pickAnnouncementMessages(announcements, "es")).toEqual([
      "Aviso de integración",
    ]);
    expect(modules.pickAnnouncementMessages(announcements, "en")).toEqual([
      "Integration notice",
    ]);
    const [instagram] = await modules.readSiteStats("es");
    expect(instagram).toMatchObject({ id: "instagram", value: "999K" });
    const entries = await database<{ action: string }[]>`
      select action from public.audit_log where actor_id = ${admin.userId}
      order by action`;
    expect(entries.map(({ action }) => action)).toEqual([
      "setting.update",
      "site_text.update",
    ]);
  });

  it("el valor vacío en los dos idiomas quita la cifra del sitio", async () => {
    const admin = await createTestSession(status, { role: "admin" });

    await modules.saveStats(
      buildArgs(
        admin,
        await statFields(admin, {
          "stats.instagram.value:es": "",
          "stats.instagram.value:en": "",
        }),
      ),
    );

    const stats = await modules.readSiteStats("es");
    expect(stats.map(({ id }) => id)).not.toContain("instagram");
  });

  it.each(["buyer", "staff"] as const)(
    "con la sesión de un %s la base no deja leer la barra ni escribir",
    async (role) => {
      const outsider = await createTestSession(status, { role });
      const client = sessionClient(outsider);

      const bar = await client
        .from("settings")
        .upsert({ key: BAR_KEY, value: [] });
      const text = await client.from("site_texts").upsert({
        key: "stats.instagram.value",
        locale: "es",
        value: "0",
      });
      const read = await client
        .from("settings")
        .select("value")
        .eq("key", BAR_KEY);

      expect(bar.error).not.toBeNull();
      expect(text.error).not.toBeNull();
      expect(read.data).toEqual([]);
    },
  );
});
