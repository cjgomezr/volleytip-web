import { isRouteErrorResponse } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

async function callIn(appEnv: AppEnvironment, search = ""): Promise<unknown> {
  vi.resetModules();
  stubAppEnv(appEnv);
  const route = await import("./dev-failure");
  const request = new Request(`http://localhost/dev/fallo${search}`);
  try {
    route.loader({ request } as Parameters<typeof route.loader>[0]);
  } catch (error) {
    return error;
  }
  throw new Error("Se esperaba que la ruta lanzara");
}

function statusOf(thrown: unknown): number | undefined {
  if (isRouteErrorResponse(thrown)) return thrown.status;
  if (typeof thrown === "object" && thrown !== null && "init" in thrown) {
    return (thrown.init as ResponseInit | null)?.status;
  }
  return undefined;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ruta que falla a propósito", () => {
  it("lanza un error no controlado fuera de producción", async () => {
    expect(await callIn("local")).toBeInstanceOf(Error);
  });

  it("con ?estado=403 lanza una respuesta controlada 403", async () => {
    expect(statusOf(await callIn("local", "?estado=403"))).toBe(403);
  });

  it("en producción responde 404", async () => {
    expect(statusOf(await callIn("production"))).toBe(404);
  });
});
