import { afterEach, describe, expect, it, vi } from "vitest";

import { stubAppEnv } from "~/testing/stub-app-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

function buildArgs<Args>(query: string): Args {
  return {
    request: new Request(`http://localhost/dev/equipo${query}`),
  } as unknown as Args;
}

describe("muestra del equipo", () => {
  it.each([
    ["", { screen: "list", view: { notice: null } }],
    ["?estado=invitar", { screen: "invite" }],
    ["?estado=errores", { screen: "invite", outcome: { status: "invalid" } }],
    ["?estado=confirmar", { screen: "confirmation" }],
    [
      "?estado=ultimo-admin",
      { screen: "confirmation", outcome: { error: "lastAdmin" } },
    ],
  ])("pinta el estado %j", async (query, expected) => {
    const { loader } = await import("./dev-team");

    expect(loader(buildArgs(query))).toMatchObject(expected);
  });

  it("un estado que no existe responde 404", async () => {
    const { loader } = await import("./dev-team");

    expect(() => loader(buildArgs("?estado=otro"))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });

  it("en producción responde 404", async () => {
    vi.resetModules();
    stubAppEnv("production");
    const { loader } = await import("./dev-team");

    expect(() => loader(buildArgs(""))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });
});
