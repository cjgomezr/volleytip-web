import { afterEach, describe, expect, it, vi } from "vitest";

import { stubAppEnv } from "~/testing/stub-app-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

function buildArgs<Args>(query: string): Args {
  return {
    request: new Request(`http://localhost/dev/ajustes${query}`),
  } as unknown as Args;
}

describe("muestra de los ajustes", () => {
  it.each([
    ["", { screen: "settings", view: { maintenance: "off" } }],
    ["?estado=encendido", { view: { maintenance: "on" } }],
    ["?estado=invalido", { view: { maintenance: "invalid" } }],
    ["?estado=errores", { rejection: { values: { status: "available" } } }],
    ["?estado=confirmar", { screen: "confirmation" }],
  ])("pinta el estado %j", async (query, expected) => {
    const { loader } = await import("./dev-settings");

    expect(loader(buildArgs(query))).toMatchObject(expected);
  });

  it("un estado que no existe responde 404", async () => {
    const { loader } = await import("./dev-settings");

    expect(() => loader(buildArgs("?estado=otro"))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });

  it("en producción responde 404", async () => {
    vi.resetModules();
    stubAppEnv("production");
    const { loader } = await import("./dev-settings");

    expect(() => loader(buildArgs(""))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });
});
