import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

const NOT_FOUND_STATUS = 404;

async function loadDevTips(
  appEnv: AppEnvironment,
  path: string,
): Promise<unknown> {
  vi.resetModules();
  stubAppEnv(appEnv);
  const route = await import("./dev-tips");
  const request = new Request(`https://volleytip.test${path}`);
  return route.loader({ request } as Parameters<typeof route.loader>[0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("listado de tips: ruta de /dev/", () => {
  it.each([
    ["/dev/tips", { publishedTotal: 105, hasNextPage: true }],
    [
      "/dev/tips?estado=filtrado",
      { latestTip: null, query: { fundamental: "reception", level: "basic" } },
    ],
    ["/dev/tips?estado=sin-resultados", { total: 0, publishedTotal: 105 }],
    ["/dev/tips?estado=vacio", { publishedTotal: 0, tips: [] }],
  ])("%s pinta su estado", async (path, listing) => {
    await expect(loadDevTips("test", path)).resolves.toMatchObject({
      listing,
    });
  });

  it("en inglés trae un tip que cayó al español", async () => {
    await expect(loadDevTips("test", "/en/dev/tips")).resolves.toMatchObject({
      language: "en",
      listing: {
        tips: expect.arrayContaining([
          expect.objectContaining({ titleLanguage: "es" }),
        ]),
      },
    });
  });

  it.each([
    ["production", "/dev/tips"],
    ["test", "/dev/tips?estado=otro"],
    ["test", "/dev/tips?estado=constructor"],
  ] as const)("en %s, %s responde 404", async (appEnv, path) => {
    await expect(loadDevTips(appEnv, path)).rejects.toMatchObject({
      init: { status: NOT_FOUND_STATUS },
    });
  });
});
