import { RouterContextProvider } from "react-router";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  connectToLocalDatabase,
  takeOnlyRow,
  type Database,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
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

type PanelModules = typeof import("~/routes/panel/language") &
  typeof import("~/lib/panel/panel-middleware.server") &
  typeof import("~/lib/supabase/session-client.server");

// El entorno del servidor se lee al cargar sus módulos: se importan después
// de apuntar las variables a la base local.
async function loadPanelModules(
  status: LocalSupabaseStatus,
): Promise<PanelModules> {
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  return {
    ...(await import("~/routes/panel/language")),
    ...(await import("~/lib/panel/panel-middleware.server")),
    ...(await import("~/lib/supabase/session-client.server")),
  };
}

const createdUserIds: string[] = [];
let status: LocalSupabaseStatus;
let panel: PanelModules;
let database: Database;

type LanguageArgs = Parameters<PanelModules["action"]>[0];

async function buildArgs({ cookies }: TestSession): Promise<LanguageArgs> {
  const request = new Request("http://localhost/admin/idioma", {
    method: "POST",
    headers: { Cookie: toCookieHeader(cookies) },
    body: new URLSearchParams({ language: "en", from: "/admin" }),
  });
  const session = panel.createSessionSupabaseClient(request);
  const context = new RouterContextProvider();
  context.set(panel.panelSessionContext, session);
  context.set(
    panel.panelMemberContext,
    await panel.verifyPanelMember(request, session.client),
  );
  return { request, context, params: {} } as unknown as LanguageArgs;
}

describeIntegration("idioma del panel contra la base local", () => {
  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    panel = await loadPanelModules(status);
    database = connectToLocalDatabase();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await database.end();
    for (const userId of createdUserIds) {
      await deleteTestSessionUser(status, userId);
    }
  });

  it("un admin guarda su idioma en profiles.locale y queda en la bitácora", async () => {
    const admin = await createTestSession(status, { role: "admin" });
    createdUserIds.push(admin.userId);

    const response = (await panel.action(await buildArgs(admin))) as Response;

    expect(response.headers.get("Location")).toBe("/en/admin");
    const profiles = await database`
      select locale from public.profiles where id = ${admin.userId}
    `;
    expect(takeOnlyRow([...profiles], "profiles")).toEqual({ locale: "en" });
    const entries = await database`
      select action, entity, entity_id, details
      from public.audit_log where actor_id = ${admin.userId}
    `;
    expect(takeOnlyRow([...entries], "audit_log")).toEqual({
      action: "profile.set_locale",
      entity: "profile",
      entity_id: admin.userId,
      details: { before: { locale: "es" }, after: { locale: "en" } },
    });
  });
});
