import { RouterContextProvider, createStaticHandler } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { enforceMaintenanceMode } from "./maintenance-middleware.server";
import { siteSettingsContext, type SiteSettings } from "./site-settings.server";

const loadSiteSettings = vi.hoisted(() => vi.fn());
vi.mock("./site-settings.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./site-settings.server")>()),
  loadSiteSettings,
}));

afterEach(() => vi.resetAllMocks());

const ON: SiteSettings = { maintenance: { enabled: true }, announcements: [] };
const OFF: SiteSettings = {
  maintenance: { enabled: false },
  announcements: [],
};

async function run(
  path: string,
  method = "GET",
): Promise<{ thrown: unknown; context: RouterContextProvider }> {
  const context = new RouterContextProvider();
  const request = new Request(`http://localhost${path}`, { method });
  try {
    await enforceMaintenanceMode({ request, context });
  } catch (thrown) {
    return { thrown, context };
  }
  return { thrown: undefined, context };
}

describe("respuesta de mantenimiento", () => {
  it.each(["GET", "POST"])("corta un %s con un 503", async (method) => {
    loadSiteSettings.mockResolvedValue(ON);

    const { thrown } = await run("/tienda", method);

    expect(thrown).toMatchObject({
      data: { kind: "maintenance", returnsAt: null },
      init: { status: 503 },
    });
  });

  it("también corta una dirección que no existe y la versión en inglés", async () => {
    loadSiteSettings.mockResolvedValue(ON);

    expect((await run("/no-existe")).thrown).toBeDefined();
    expect((await run("/en/no-existe")).thrown).toBeDefined();
    expect((await run("/en/_.data")).thrown).toBeDefined();
  });

  it("lleva la hora de regreso solo si sigue en el futuro", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    loadSiteSettings.mockResolvedValue({
      ...ON,
      maintenance: { enabled: true, returnsAt: future },
    });
    expect((await run("/")).thrown).toMatchObject({
      data: { returnsAt: future },
    });

    loadSiteSettings.mockResolvedValue({
      ...ON,
      maintenance: { enabled: true, returnsAt: "2020-01-01T00:00:00Z" },
    });
    expect((await run("/")).thrown).toMatchObject({
      data: { returnsAt: null },
    });
  });

  it("deja pasar la petición con el modo apagado y guarda los ajustes en el contexto", async () => {
    loadSiteSettings.mockResolvedValue(OFF);

    const { thrown, context } = await run("/");

    expect(thrown).toBeUndefined();
    expect(context.get(siteSettingsContext)).toBe(OFF);
  });
});

describe("direcciones exentas", () => {
  it.each([
    "/healthz",
    "/.well-known/assetlinks.json",
    "/admin",
    "/admin/pedidos",
  ])(
    "responde %s como con el modo apagado, sin consultar la base",
    async (path) => {
      loadSiteSettings.mockResolvedValue(ON);

      const { thrown } = await run(path, "POST");

      expect(thrown).toBeUndefined();
      expect(loadSiteSettings).not.toHaveBeenCalled();
    },
  );

  it("no deja libre /administracion", async () => {
    loadSiteSettings.mockResolvedValue(ON);

    expect((await run("/administracion")).thrown).toBeDefined();
  });
});

describe("con el enrutador de React Router", () => {
  async function queryThroughRouter(
    request: Request,
    action: () => null,
  ): Promise<{ status: number; error: unknown }> {
    const handler = createStaticHandler([
      {
        id: "root",
        path: "/",
        middleware: [enforceMaintenanceMode],
        action,
        children: [{ path: "*", loader: () => null }],
      },
    ]);
    const result = await handler.query(request, {
      generateMiddlewareResponse: async (query) => {
        const context = await query(request);
        return Response.json({
          status:
            context instanceof Response ? context.status : context.statusCode,
          error: context instanceof Response ? null : context.errors?.root,
        });
      },
      requestContext: new RouterContextProvider(),
    });
    return (await (result as Response).json()) as {
      status: number;
      error: unknown;
    };
  }

  it("responde 503 a un POST y no corre el action", async () => {
    loadSiteSettings.mockResolvedValue(ON);
    const action = vi.fn(() => null);

    const { status } = await queryThroughRouter(
      new Request("http://localhost/", { method: "POST", body: "x" }),
      action,
    );

    expect(status).toBe(503);
    expect(action).not.toHaveBeenCalled();
  });

  it("responde 503 a una dirección inexistente, no 404", async () => {
    loadSiteSettings.mockResolvedValue(ON);

    const { status } = await queryThroughRouter(
      new Request("http://localhost/no-existe"),
      () => null,
    );

    expect(status).toBe(503);
  });

  it("corre el action con el modo apagado", async () => {
    loadSiteSettings.mockResolvedValue(OFF);
    const action = vi.fn(() => null);

    await queryThroughRouter(
      new Request("http://localhost/", { method: "POST", body: "x" }),
      action,
    );

    expect(action).toHaveBeenCalledOnce();
  });
});
