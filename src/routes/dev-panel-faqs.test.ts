import { afterEach, describe, expect, it, vi } from "vitest";

import { stubAppEnv } from "~/testing/stub-app-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

function buildArgs<Args>(query: string): Args {
  return {
    request: new Request(`http://localhost/dev/preguntas${query}`),
  } as unknown as Args;
}

describe("muestra de las preguntas del panel", () => {
  it.each([
    ["", { screen: "list" }],
    ["?estado=vacia", { screen: "list", view: { rows: [] } }],
    ["?estado=editor", { screen: "editor", view: { status: "published" } }],
    ["?estado=errores", { screen: "editor", outcome: { status: "invalid" } }],
  ])("pinta el estado %j", async (query, expected) => {
    const { loader } = await import("./dev-panel-faqs");

    expect(loader(buildArgs(query))).toMatchObject(expected);
  });

  it("un estado que no existe responde 404", async () => {
    const { loader } = await import("./dev-panel-faqs");

    expect(() => loader(buildArgs("?estado=otro"))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });

  it("en producción responde 404", async () => {
    vi.resetModules();
    stubAppEnv("production");
    const { loader } = await import("./dev-panel-faqs");

    expect(() => loader(buildArgs(""))).toThrow(
      expect.objectContaining({ init: { status: 404 } }),
    );
  });
});
