import { randomUUID } from "node:crypto";
import { RouterContextProvider, type ActionFunctionArgs } from "react-router";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  connectToLocalDatabase,
  takeOnlyRow,
  type Database,
} from "~/testing/database";
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

// El entorno del servidor se lee al cargar sus módulos: se importan después
// de apuntar las variables a la base local.
async function loadPanelModules(
  status: LocalSupabaseStatus,
): Promise<PanelModules> {
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  return {
    ...(await import("~/lib/panel/admin-action.server")),
    ...(await import("~/lib/panel/panel-middleware.server")),
    ...(await import("~/lib/supabase/session-client.server")),
  };
}

type PanelModules = typeof import("~/lib/panel/admin-action.server") &
  typeof import("~/lib/panel/panel-middleware.server") &
  typeof import("~/lib/supabase/session-client.server");

describeIntegration("acción del admin contra la base local", () => {
  let database: Database;
  let status: LocalSupabaseStatus;
  let panel: PanelModules;

  function buildArgs({ cookies }: TestSession): ActionFunctionArgs {
    const request = new Request("http://localhost/admin/muestra", {
      method: "POST",
      headers: { Cookie: toCookieHeader(cookies) },
    });
    const context = new RouterContextProvider();
    context.set(
      panel.panelSessionContext,
      panel.createSessionSupabaseClient(request),
    );
    return { request, context, params: {} } as unknown as ActionFunctionArgs;
  }

  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    panel = await loadPanelModules(status);
    database = connectToLocalDatabase();
  });

  // El admin se queda: `audit_log` no deja borrar al autor de una entrada.
  // Desaparece con el siguiente `npm run db:reset`.
  afterAll(async () => {
    vi.unstubAllEnvs();
    await database.end();
  });

  it("una acción de muestra deja su fila en audit_log con el actor correcto", async () => {
    const admin = await createTestSession(status, { role: "admin" });
    const entityId = randomUUID();
    const action = panel.defineAdminAction({
      name: "sample.rename",
      auditedFields: ["title"],
      run: async () => ({
        result: null,
        change: {
          entityId,
          before: { title: "Antes" },
          after: { title: "Después" },
        },
      }),
    });

    await action(buildArgs(admin));

    const rows = await database`
      select actor_id, action, entity, entity_id, details
      from public.audit_log where entity_id = ${entityId}
    `;
    expect(takeOnlyRow([...rows], "audit_log")).toEqual({
      actor_id: admin.userId,
      action: "sample.rename",
      entity: "sample",
      entity_id: entityId,
      details: { before: { title: "Antes" }, after: { title: "Después" } },
    });
  });
});
