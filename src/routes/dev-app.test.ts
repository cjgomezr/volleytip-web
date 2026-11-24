import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

const NOT_FOUND_STATUS = 404;

async function loadDevApp(
  appEnv: AppEnvironment,
  query: string,
): Promise<unknown> {
  vi.resetModules();
  stubAppEnv(appEnv);
  const route = await import("./dev-app");
  const request = new Request(`https://volleytip.test/dev/app${query}`);
  return route.loader({ request } as Parameters<typeof route.loader>[0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("app: ruta de /dev/", () => {
  it("sin parámetros pinta la lista de espera", async () => {
    const loaded = await loadDevApp("test", "");

    expect(loaded).toMatchObject({
      availability: { state: "waitlist" },
      outcome: undefined,
    });
  });

  it("con estado disponible pinta las dos tiendas", async () => {
    const loaded = await loadDevApp("test", "?estado=disponible");

    expect(loaded).toMatchObject({
      availability: {
        state: "available",
        appStoreUrl: expect.stringContaining("https://apps.apple.com/"),
        playStoreUrl: expect.stringContaining("https://play.google.com/"),
      },
    });
  });

  it("con la tienda pedida pinta solo esa", async () => {
    const loaded = await loadDevApp("test", "?estado=disponible&tienda=play");

    expect(loaded).toMatchObject({
      availability: { appStoreUrl: null },
    });
  });

  it("con un resultado pedido lo pinta", async () => {
    const loaded = await loadDevApp("test", "?resultado=unido");

    expect(loaded).toMatchObject({ outcome: { status: "joined" } });
  });

  it("en producción responde 404", async () => {
    await expect(loadDevApp("production", "")).rejects.toMatchObject({
      init: { status: NOT_FOUND_STATUS },
    });
  });
});
