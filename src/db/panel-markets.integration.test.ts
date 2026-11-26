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

const RATE_KEY = "usd_reference_rate";

type Modules = {
  readonly languageRoute: typeof import("~/routes/panel/markets-language");
  readonly marketRoute: typeof import("~/routes/panel/markets-market");
  readonly rateRoute: typeof import("~/routes/panel/markets-rate");
  readonly screenRoute: typeof import("~/routes/panel/markets");
  readonly panel: typeof import("~/lib/panel/panel-middleware.server");
  readonly session: typeof import("~/lib/supabase/session-client.server");
  readonly usdRate: typeof import("~/lib/usd-rate.server");
  readonly activeLanguages: typeof import("~/lib/active-languages.server");
};

// El entorno del servidor se lee al cargar sus módulos: se importan después
// de apuntar las variables a la base local.
async function loadModules(status: LocalSupabaseStatus): Promise<Modules> {
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  return {
    languageRoute: await import("~/routes/panel/markets-language"),
    marketRoute: await import("~/routes/panel/markets-market"),
    rateRoute: await import("~/routes/panel/markets-rate"),
    screenRoute: await import("~/routes/panel/markets"),
    panel: await import("~/lib/panel/panel-middleware.server"),
    session: await import("~/lib/supabase/session-client.server"),
    usdRate: await import("~/lib/usd-rate.server"),
    activeLanguages: await import("~/lib/active-languages.server"),
  };
}

describeIntegration("idiomas y mercados del panel contra la base local", () => {
  let database: Database;
  let modules: Modules;
  let admin: TestSession;
  let originalRate: string | undefined;
  let colombia: string;

  function buildArgs<Args>(
    path: string,
    fields?: readonly (readonly [string, string])[],
  ): Args {
    const request = new Request(`http://localhost${path}`, {
      method: fields === undefined ? "GET" : "POST",
      headers: { Cookie: toCookieHeader(admin.cookies) },
      body:
        fields === undefined
          ? undefined
          : new URLSearchParams(fields.map(([name, value]) => [name, value])),
    });
    const context = new RouterContextProvider();
    context.set(
      modules.panel.panelSessionContext,
      modules.session.createSessionSupabaseClient(request),
    );
    return { request, context, params: {} } as unknown as Args;
  }

  function deactivateColombia(): Promise<unknown> {
    return modules.marketRoute.action(
      buildArgs("/admin/mercados/mercado", [
        ["id", colombia],
        ["isActive", "false"],
        ["shipsPhysical", "false"],
        ["shipsPhysical", "true"],
        ["defaultLocale", "es"],
      ]),
    );
  }

  function submitLanguage(code: string, isActive: boolean): Promise<unknown> {
    return modules.languageRoute.action(
      buildArgs("/admin/mercados/idioma", [
        ["code", code],
        ["isActive", String(isActive)],
      ]),
    );
  }

  async function restoreSeed(): Promise<void> {
    await database`update public.languages set is_active = true where code = 'en'`;
    await database`
      update public.markets set payment_methods = '{}', is_active = true
      where country_code = 'CO'`;
    await database`delete from public.settings where key = ${RATE_KEY}`;
  }

  beforeAll(async () => {
    const status = readLocalSupabaseStatus();
    modules = await loadModules(status);
    database = connectToLocalDatabase();
    const [rate] = await database<{ value: string }[]>`
      select value::text as value from public.settings where key = ${RATE_KEY}`;
    originalRate = rate?.value;
    const [market] = await database<{ id: string }[]>`
      select id from public.markets where country_code = 'CO'`;
    if (market === undefined) throw new Error("Falta el mercado de Colombia.");
    colombia = market.id;
    admin = await createTestSession(status, { role: "admin" });
  });

  beforeEach(restoreSeed);

  // El admin se queda: `audit_log` no deja borrar al autor de una entrada.
  afterAll(async () => {
    await restoreSeed();
    if (originalRate !== undefined) {
      await database`insert into public.settings (key, value) values (${RATE_KEY}, ${originalRate}::text::jsonb)`;
    }
    vi.unstubAllEnvs();
    await database.end();
  });

  it("la tasa nueva sale en el lector del sitio", async () => {
    await modules.rateRoute.action(
      buildArgs("/admin/mercados/tasa", [["rate", "4150"]]),
    );
    await expect(modules.usdRate.readUsdReferenceRate()).resolves.toBe(4150);

    await modules.rateRoute.action(
      buildArgs("/admin/mercados/tasa", [["rate", "3900"]]),
    );
    await expect(modules.usdRate.readUsdReferenceRate()).resolves.toBe(3900);
  });

  it("desactivar un idioma lo quita de los que lee el sitio", async () => {
    await submitLanguage("en", false);

    await expect(
      modules.activeLanguages.loadActiveLanguages(),
    ).resolves.toEqual(["es"]);

    await submitLanguage("en", true);
    await expect(
      modules.activeLanguages.loadActiveLanguages(),
    ).resolves.toEqual(["es", "en"]);
  });

  it("la pantalla del admin ve también el idioma desactivado", async () => {
    await submitLanguage("en", false);

    const view = await modules.screenRoute.loader(buildArgs("/admin/mercados"));

    expect(
      view.languages.map(({ code, isActive }) => [code, isActive]),
    ).toEqual([
      ["es", true],
      ["en", false],
    ]);
  });

  it("el rechazo del idioma por defecto llega a la pantalla", async () => {
    await expect(submitLanguage("es", false)).resolves.toMatchObject({
      data: { error: "defaultLanguage" },
      init: { status: 400 },
    });
  });

  it("el rechazo del único mercado activo llega a la pantalla", async () => {
    await expect(deactivateColombia()).resolves.toMatchObject({
      data: { formError: "lastActiveMarket" },
      init: { status: 400 },
    });
  });

  it("guarda un mercado y deja la entrada en la bitácora", async () => {
    await modules.marketRoute.action(
      buildArgs("/admin/mercados/mercado", [
        ["id", colombia],
        ["isActive", "true"],
        ["shipsPhysical", "true"],
        ["defaultLocale", "es"],
        ["paymentMethods", "pse"],
      ]),
    );

    const [entry] = await database<{ details: unknown }[]>`
      select details from public.audit_log
      where action = 'market.update' and entity_id = ${colombia}
      order by created_at desc limit 1`;
    expect(entry?.details).toEqual({
      before: { payment_methods: [] },
      after: { payment_methods: ["pse"] },
    });
  });
});
