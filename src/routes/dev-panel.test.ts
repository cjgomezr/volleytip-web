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

  it.each(["datos", "errores", "confirmacion", "invalido"])(
    "pinta Textos del sitio en el estado %s, sin la base",
    async (state) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const route = await loadRoute("test");

      const { siteTexts } = route.loader(
        buildArgs<LoaderArgs>(`/dev/panel/textos?textos=${state}`),
      );

      expect(siteTexts?.limits.maxMessages).toBe(3);
      expect(siteTexts?.barOutcome?.status === "invalid").toBe(
        state === "errores",
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("sin pedirlo, la sección de muestra no pinta Textos del sitio", async () => {
    const route = await loadRoute("test");

    const loaded = route.loader(buildArgs<LoaderArgs>("/dev/panel/textos"));

    expect(loaded.siteTexts).toBeNull();
  });

  it("con `barra=llena` ocupa los cinco lugares, con contador en 'Más'", async () => {
    const route = await loadRoute("test");
    const { buildPanelNavigation } = await import("~/lib/admin/navigation");

    const { isBarFull } = route.loader(
      buildArgs<LoaderArgs>("/dev/panel?barra=llena"),
    );
    const { FULL_BAR_SAMPLE } = await import("~/lib/admin/sample-modules");
    const { bar, more } = buildPanelNavigation(FULL_BAR_SAMPLE.modules, {
      role: "admin",
      language: "es",
      pathname: "/dev/panel",
      pendingCounts: FULL_BAR_SAMPLE.pendingCounts,
      morePath: "/dev/panel/mas",
    });

    expect(isBarFull).toBe(true);
    expect(bar).toHaveLength(4);
    expect(bar.at(-1)?.pendingCount).toBeGreaterThan(0);
    expect(more.some(({ pendingCount }) => pendingCount)).toBe(true);
  });

  it.each([
    ["datos", "ok"],
    ["vacio", "ok"],
    ["fallo", "failed"],
  ])("`resumen=%s` pinta el resumen sin la base", async (state, status) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const route = await loadRoute("test");

    const { overview } = route.loader(
      buildArgs<LoaderArgs>(`/dev/panel?resumen=${state}`),
    );

    expect(overview?.cards[0]?.value.status).toBe(status);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("el resumen con datos enlaza la tarjeta de mensajes y el vacío no", async () => {
    const route = await loadRoute("test");
    const readHref = (path: string): string | undefined =>
      route.loader(buildArgs<LoaderArgs>(path)).overview?.cards[0]?.href;

    expect(readHref("/en/dev/panel?resumen=datos")).toBe(
      "/en/dev/panel/messages?estado=new",
    );
    expect(readHref("/dev/panel?resumen=vacio")).toBeUndefined();
  });

  it.each([
    "/dev/panel",
    "/dev/panel?resumen=otro",
    "/dev/panel/mas?resumen=datos",
  ])("%s no pinta el resumen", async (path) => {
    const route = await loadRoute("test");

    expect(route.loader(buildArgs<LoaderArgs>(path)).overview).toBeNull();
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
