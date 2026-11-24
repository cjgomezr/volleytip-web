import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

const NOT_FOUND_STATUS = 404;

async function loadDevContact(
  appEnv: AppEnvironment,
  path: string,
): Promise<unknown> {
  vi.resetModules();
  stubAppEnv(appEnv);
  const route = await import("./dev-contact");
  const request = new Request(`https://volleytip.test${path}`);
  return route.loader({ request } as Parameters<typeof route.loader>[0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("contacto: ruta de /dev/", () => {
  it("pinta el motivo y el resultado que pide la dirección", async () => {
    const loaded = await loadDevContact(
      "test",
      "/en/dev/contact?motivo=marcas&resultado=invalido",
    );

    expect(loaded).toMatchObject({
      language: "en",
      reason: "brands",
      outcome: { status: "invalid" },
    });
  });

  it("sin parámetros pinta 'Otro' y el formulario sin resultado", async () => {
    const loaded = await loadDevContact("test", "/dev/contact");

    expect(loaded).toMatchObject({ language: "es", reason: "other" });
    expect((loaded as { outcome: unknown }).outcome).toBeUndefined();
  });

  it("en producción responde 404", async () => {
    await expect(
      loadDevContact("production", "/dev/contact"),
    ).rejects.toMatchObject({ init: { status: NOT_FOUND_STATUS } });
  });
});
