import { afterEach, describe, expect, it, vi } from "vitest";

import { stubAppEnv } from "~/testing/stub-app-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("muestra de la entrada al panel", () => {
  it.each([
    ["", { screen: "form", outcome: undefined }],
    ["?estado=enviado", { screen: "form", outcome: { status: "sent" } }],
    ["?estado=error", { screen: "form", outcome: { status: "invalid" } }],
    ["?estado=enlace", { screen: "link", status: undefined }],
    ["?estado=vencido", { screen: "link", status: "invalid_link" }],
  ])("pinta el estado %j", async (query, expected) => {
    const { loader } = await import("./dev-sign-in");

    const data = loader({
      request: new Request(`http://localhost/dev/entrar${query}`),
    } as Parameters<typeof loader>[0]);

    expect(data).toMatchObject(expected);
  });

  it("en producción responde 404", async () => {
    vi.resetModules();
    stubAppEnv("production");
    const { loader } = await import("./dev-sign-in");

    expect(() =>
      loader({
        request: new Request("http://localhost/dev/entrar"),
      } as Parameters<typeof loader>[0]),
    ).toThrow(expect.objectContaining({ init: { status: 404 } }));
  });
});
