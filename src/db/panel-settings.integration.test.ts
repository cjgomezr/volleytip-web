import { RouterContextProvider } from "react-router";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

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

const APP_STORE = "https://apps.apple.com/co/app/volleytip/id123";
const KEYS = ["maintenance_mode", "app_availability"];

type Modules = {
  readonly maintenanceRoute: typeof import("~/routes/panel/maintenance");
  readonly settingsRoute: typeof import("~/routes/panel/settings");
  readonly panel: typeof import("~/lib/panel/panel-middleware.server");
  readonly session: typeof import("~/lib/supabase/session-client.server");
  readonly settings: typeof import("~/lib/settings.server");
  readonly maintenance: typeof import("~/lib/maintenance-mode.server");
  readonly middleware: typeof import("~/lib/maintenance-middleware.server");
  readonly app: typeof import("~/lib/app-availability.server");
};

// El entorno del servidor se lee al cargar sus módulos: se importan después
// de apuntar las variables a la base local.
async function loadModules(status: LocalSupabaseStatus): Promise<Modules> {
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  return {
    maintenanceRoute: await import("~/routes/panel/maintenance"),
    settingsRoute: await import("~/routes/panel/settings"),
    panel: await import("~/lib/panel/panel-middleware.server"),
    session: await import("~/lib/supabase/session-client.server"),
    settings: await import("~/lib/settings.server"),
    maintenance: await import("~/lib/maintenance-mode.server"),
    middleware: await import("~/lib/maintenance-middleware.server"),
    app: await import("~/lib/app-availability.server"),
  };
}

describeIntegration("ajustes del panel contra la base local", () => {
  let database: Database;
  let status: LocalSupabaseStatus;
  let modules: Modules;
  let admin: TestSession;
  let originals: readonly { key: string; value: string }[];

  function buildArgs<Args>(
    path: string,
    fields: Record<string, string>,
    { cookies }: TestSession,
  ): Args {
    const request = new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { Cookie: toCookieHeader(cookies) },
      body: new URLSearchParams(fields),
    });
    const context = new RouterContextProvider();
    context.set(
      modules.panel.panelSessionContext,
      modules.session.createSessionSupabaseClient(request),
    );
    return { request, context, params: {} } as unknown as Args;
  }

  function submitMaintenance(
    fields: Record<string, string>,
    who: TestSession = admin,
  ): Promise<unknown> {
    return modules.maintenanceRoute.action(
      buildArgs("/admin/ajustes/mantenimiento", fields, who),
    );
  }

  // Lo que hace el middleware de la raíz con una petición del sitio.
  function visit(path: string): Promise<void> {
    return modules.middleware.enforceMaintenanceMode({
      request: new Request(`http://localhost${path}`),
      context: new RouterContextProvider(),
    });
  }

  async function removeSettings(): Promise<void> {
    await database`delete from public.settings where key in ${database(KEYS)}`;
  }

  beforeAll(async () => {
    status = readLocalSupabaseStatus();
    modules = await loadModules(status);
    database = connectToLocalDatabase();
    originals = await database<{ key: string; value: string }[]>`
      select key, value::text as value from public.settings
      where key in ${database(KEYS)}
    `;
    admin = await createTestSession(status, { role: "admin" });
  });

  beforeEach(removeSettings);

  // El admin se queda: `audit_log` no deja borrar al autor de una entrada.
  afterAll(async () => {
    await removeSettings();
    for (const { key, value } of originals) {
      await database`insert into public.settings (key, value) values (${key}, ${value}::text::jsonb)`;
    }
    vi.unstubAllEnvs();
    await database.end();
  });

  it("encender desde el panel lo ve el lector del sitio, y el panel sigue", async () => {
    await submitMaintenance({ enabled: "true", confirm: "yes" });

    await expect(
      modules.settings.readSetting(
        modules.maintenance.MAINTENANCE_MODE_SETTING,
      ),
    ).resolves.toEqual({ enabled: true });
    await expect(visit("/")).rejects.toMatchObject({ init: { status: 503 } });
    for (const path of ["/admin", "/en/admin", "/admin/entrar"]) {
      await expect(visit(path), path).resolves.toBeUndefined();
    }
  });

  it("apagar desde el panel devuelve el sitio en la petición siguiente", async () => {
    await submitMaintenance({ enabled: "true", confirm: "yes" });

    await submitMaintenance({ enabled: "false" });

    await expect(visit("/")).resolves.toBeUndefined();
  });

  it("el estado de la app guardado lo lee la página /app", async () => {
    await modules.settingsRoute.action(
      buildArgs(
        "/admin/ajustes",
        { status: "available", appStoreUrl: APP_STORE },
        admin,
      ),
    );

    await expect(modules.app.readAppAvailability()).resolves.toEqual({
      state: "available",
      appStoreUrl: APP_STORE,
      playStoreUrl: null,
    });
  });

  it("deja en la bitácora quién cambió qué, con el antes y el después", async () => {
    const author = await createTestSession(status, { role: "admin" });

    await submitMaintenance({ enabled: "true", confirm: "yes" }, author);
    await submitMaintenance({ enabled: "false" }, author);

    const rows = await database`
      select action, details from public.audit_log
      where actor_id = ${author.userId} order by created_at
    `;
    expect([...rows]).toEqual([
      {
        action: "settings.set_maintenance",
        details: {
          key: "maintenance_mode",
          before: null,
          after: { value: { enabled: true } },
        },
      },
      {
        action: "settings.set_maintenance",
        details: {
          key: "maintenance_mode",
          before: { value: { enabled: true } },
          after: { value: { enabled: false } },
        },
      },
    ]);
  });

  it.each(["buyer", "staff"] as const)(
    "un %s no cambia el ajuste",
    async (role) => {
      const other = await createTestSession(status, { role });

      await expect(
        submitMaintenance({ enabled: "true", confirm: "yes" }, other),
      ).rejects.toBeDefined();

      const rows = await database`
        select key from public.settings where key = 'maintenance_mode'
      `;
      expect([...rows]).toEqual([]);
    },
  );
});
