import { afterEach, describe, expect, it, vi } from "vitest";

import { stubAppEnv } from "~/testing/stub-app-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

function buildArgs<Args>(query: string): Args {
  return {
    request: new Request(`http://localhost/dev/mensajes${query}`),
  } as unknown as Args;
}

describe("muestra de la bandeja", () => {
  it.each([
    ["", { screen: "inbox", view: { total: 120 } }],
    ["?estado=vacia", { screen: "inbox", view: { rows: [] } }],
    [
      "?estado=sin-resultados",
      { screen: "inbox", view: { rows: [], query: { reason: "brands" } } },
    ],
    [
      "?estado=detalle-pedido",
      { screen: "message", view: { reason: "order" } },
    ],
    [
      "?estado=detalle-marcas",
      { screen: "message", view: { reason: "brands" } },
    ],
  ])("pinta el estado %j", async (query, expected) => {
    const { loader } = await import("./dev-messages");

    expect(loader(buildArgs(query))).toMatchObject(expected);
  });

  it("un estado que no existe responde 404", async () => {
    const { loader } = await import("./dev-messages");

    expect(() => loader(buildArgs("?estado=otro"))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });

  it("en producción responde 404", async () => {
    vi.resetModules();
    stubAppEnv("production");
    const { loader } = await import("./dev-messages");

    expect(() => loader(buildArgs(""))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });
});
