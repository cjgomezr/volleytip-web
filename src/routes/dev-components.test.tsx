import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";

const NOT_FOUND_STATUS = 404;

/** Carga la ruta con otro `APP_ENV`, como en un servidor recién arrancado. */
async function loadSamplePageIn(appEnv: AppEnvironment): Promise<unknown> {
  vi.resetModules();
  vi.stubEnv("APP_ENV", appEnv);
  const route = await import("./dev-components");
  return route.loader();
}

async function catchThrown(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  } catch (error) {
    return error;
  }
  throw new Error("Se esperaba que la ruta lanzara un 404");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("página de muestra", () => {
  it.each(["local", "test", "staging"] as const)(
    "en %s el loader deja pasar",
    async (appEnv) => {
      await expect(loadSamplePageIn(appEnv)).resolves.toBeNull();
    },
  );

  it("en production lanza un 404, no una redirección", async () => {
    const thrown = await catchThrown(() => loadSamplePageIn("production"));

    expect(thrown).toMatchObject({ init: { status: NOT_FOUND_STATUS } });
    expect(thrown).not.toBeInstanceOf(Response);
  });
});
