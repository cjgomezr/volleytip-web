import { afterEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_MODULES } from "~/lib/admin/sample-modules";
import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

const NOT_FOUND = { init: { status: 404 } };

async function loadRoute(
  appEnv: AppEnvironment,
): Promise<typeof import("./dev-panel")> {
  vi.resetModules();
  stubAppEnv(appEnv);
  return import("./dev-panel");
}

function buildArgs<Args>(path: string, init?: RequestInit): Args {
  const request = new Request(`https://volleytip.test${path}`, init);
  const [, splat = ""] = /dev\/panel\/?([^?]*)/.exec(path) ?? [];
  return { request, params: { "*": splat } } as unknown as Args;
}

type LoaderArgs = Parameters<(typeof import("./dev-panel"))["loader"]>[0];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("panel de muestra: ruta de /dev/", () => {
  it("tiene ocho módulos de ejemplo y un contador", () => {
    expect(SAMPLE_MODULES).toHaveLength(8);
    expect(
      SAMPLE_MODULES.filter(({ hasPendingCounter }) => hasPendingCounter),
    ).toHaveLength(1);
  });

  it.each([
    ["/dev/panel", { isMore: false, isMaintenanceOn: false }],
    ["/dev/panel/mas", { isMore: true }],
    ["/en/dev/panel/more", { isMore: true }],
    ["/dev/panel?mantenimiento=1", { isMaintenanceOn: true }],
  ])("%s pinta lo que pide, sin la base", async (path, expected) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const route = await loadRoute("test");

    const loaded = route.loader(buildArgs<LoaderArgs>(path));

    expect(loaded).toMatchObject(expected);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("una sección que no es de la muestra responde 404", async () => {
    const route = await loadRoute("test");

    expect(() =>
      route.loader(buildArgs<LoaderArgs>("/dev/panel/no-existe")),
    ).toThrow(expect.objectContaining(NOT_FOUND));
  });

  it("cambiar el idioma lleva a la misma pantalla sin guardar", async () => {
    const route = await loadRoute("test");

    const response = (await route.action(
      buildArgs("/dev/panel", {
        method: "POST",
        body: new URLSearchParams({
          language: "en",
          from: "/dev/panel/mas?mantenimiento=1",
        }),
      }),
    )) as Response;

    expect(response.headers.get("Location")).toBe(
      "/en/dev/panel/more?mantenimiento=1",
    );
  });

  it("en producción responde 404 al abrirla y al enviar", async () => {
    const route = await loadRoute("production");

    expect(() => route.loader(buildArgs<LoaderArgs>("/dev/panel"))).toThrow(
      expect.objectContaining(NOT_FOUND),
    );
    await expect(
      route.action(buildArgs("/dev/panel", { method: "POST" })),
    ).rejects.toMatchObject(NOT_FOUND);
  });
});
