import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadRouteCode, type RouteManifest } from "./load-route-code";

const ROUTE_ID = "adminSiteTextsStats.es";
const ENTRY = {
  module: "/assets/site-texts-stats.js",
  clientActionModule: "/assets/site-texts-stats-client-action.js",
  imports: ["/assets/chunk.js"],
};

function stubManifest(routes: RouteManifest["routes"]): void {
  vi.stubGlobal("window", { __reactRouterManifest: { routes } });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("precarga del código de una ruta del panel", () => {
  it("pide el módulo de la ruta, el de su clientAction y lo que importa", () => {
    stubManifest({ [ROUTE_ID]: ENTRY });
    const load = vi.fn(() => Promise.resolve());

    loadRouteCode(ROUTE_ID, load);

    expect(load.mock.calls).toEqual([
      [ENTRY.module],
      [ENTRY.clientActionModule],
      [ENTRY.imports[0]],
    ]);
  });

  it("pide también el código de los layouts que envuelven la ruta", () => {
    stubManifest({
      root: { module: "/assets/root.js" },
      layout: { module: "/assets/layout.js", parentId: "root" },
      [ROUTE_ID]: { module: "/assets/leaf.js", parentId: "layout" },
    });
    const load = vi.fn(() => Promise.resolve());

    loadRouteCode(ROUTE_ID, load);

    expect(load.mock.calls).toEqual([
      ["/assets/leaf.js"],
      ["/assets/layout.js"],
      ["/assets/root.js"],
    ]);
  });

  // React Router agrega la ruta al manifiesto poco después de pintar el
  // formulario que apunta a ella.
  it("espera a que la ruta aparezca en el manifiesto", () => {
    const routes: Record<string, typeof ENTRY> = {};
    stubManifest(routes);
    const load = vi.fn(() => Promise.resolve());

    loadRouteCode(ROUTE_ID, load);
    routes[ROUTE_ID] = ENTRY;
    vi.advanceTimersByTime(1000);

    expect(load).toHaveBeenCalledWith(ENTRY.module);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("deja de buscar cuando el formulario se va de la pantalla", () => {
    const routes: Record<string, typeof ENTRY> = {};
    stubManifest(routes);
    const load = vi.fn(() => Promise.resolve());

    const stop = loadRouteCode(ROUTE_ID, load);
    stop();
    routes[ROUTE_ID] = ENTRY;
    vi.advanceTimersByTime(10_000);

    expect(load).not.toHaveBeenCalled();
  });

  it("no insiste para siempre con una ruta que no aparece", () => {
    stubManifest({});

    loadRouteCode(ROUTE_ID, vi.fn());
    vi.advanceTimersByTime(120_000);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("si la descarga falla, queda en la consola y no revienta", async () => {
    stubManifest({ [ROUTE_ID]: ENTRY });
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    loadRouteCode(ROUTE_ID, () =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    await vi.runAllTimersAsync();

    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
