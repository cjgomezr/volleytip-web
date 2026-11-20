import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

const NOT_FOUND_STATUS = 404;

/** Carga la ruta con otro `APP_ENV`, como en un servidor recién arrancado. */
async function loadSamplePageIn(appEnv: AppEnvironment): Promise<unknown> {
  vi.resetModules();
  stubAppEnv(appEnv);
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
    "en %s el loader entrega lo que el formulario protegido necesita",
    async (appEnv) => {
      const loaded = await loadSamplePageIn(appEnv);

      expect(loaded).toEqual({
        protection: {
          siteKey: expect.any(String) as string,
          timestamp: expect.stringMatching(/^\d+\..+$/) as string,
        },
      });
    },
  );

  it("en production lanza un 404, no una redirección", async () => {
    const thrown = await catchThrown(() => loadSamplePageIn("production"));

    expect(thrown).toMatchObject({ init: { status: NOT_FOUND_STATUS } });
    expect(thrown).not.toBeInstanceOf(Response);
  });
});

type ProtectedFormModule = typeof import("~/lib/forms/protected-form.server");
type SampleResult = Awaited<
  ReturnType<ProtectedFormModule["processProtectedForm"]>
>;

/** Envía el formulario de ejemplo con las capas simuladas: lo que se prueba
 * aquí es qué hace el action con cada resultado. Las capas tienen sus
 * propias pruebas. */
async function submitSampleForm(
  appEnv: AppEnvironment,
  result: SampleResult,
): Promise<unknown> {
  vi.resetModules();
  stubAppEnv(appEnv);
  vi.doMock("~/lib/forms/protected-form.server", async (importOriginal) => ({
    ...(await importOriginal<ProtectedFormModule>()),
    processProtectedForm: () => Promise.resolve(result),
  }));
  const route = await import("./dev-components");
  const request = new Request("https://volleytip.test/dev/componentes", {
    method: "POST",
    body: new FormData(),
  });
  return route.action({ request, params: {}, context: {} } as never);
}

describe("página de muestra: formulario de ejemplo", () => {
  afterEach(() => {
    vi.doUnmock("~/lib/forms/protected-form.server");
  });

  it("un envío aceptado responde 200 con su estado", async () => {
    const response = await submitSampleForm("staging", {
      status: "accepted",
      data: { email: "ana@ejemplo.co" },
      overLimit: false,
    });

    expect(response).toMatchObject({
      data: { status: "accepted", fieldErrors: {}, values: {} },
      init: { status: 200 },
    });
  });

  it("un envío inválido responde 400 con el error del campo y lo escrito", async () => {
    const response = await submitSampleForm("staging", {
      status: "invalid",
      fieldErrors: { email: "Escribe un correo válido" },
      formErrors: [],
      values: { email: "malo" },
    });

    expect(response).toMatchObject({
      data: {
        status: "invalid",
        fieldErrors: { email: "Escribe un correo válido" },
        values: { email: "malo" },
      },
      init: { status: 400 },
    });
  });

  it("un envío sobre el límite responde 429", async () => {
    const response = await submitSampleForm("staging", {
      status: "rate_limited",
    });

    expect(response).toMatchObject({
      data: { status: "rate_limited" },
      init: { status: 429 },
    });
  });

  it("la trampa llena responde como un envío exitoso", async () => {
    const response = await submitSampleForm("staging", { status: "discarded" });

    expect(response).toMatchObject({ init: { status: 200 } });
  });

  it("en production el action también lanza un 404", async () => {
    const thrown = await catchThrown(() =>
      submitSampleForm("production", { status: "discarded" }),
    );

    expect(thrown).toMatchObject({ init: { status: NOT_FOUND_STATUS } });
  });
});
