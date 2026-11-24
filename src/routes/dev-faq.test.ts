import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnvironment } from "~/lib/env.server";
import { stubAppEnv } from "~/testing/stub-app-env";

const NOT_FOUND_STATUS = 404;

async function loadDevFaq(
  appEnv: AppEnvironment,
  path: string,
): Promise<unknown> {
  vi.resetModules();
  stubAppEnv(appEnv);
  const route = await import("./dev-faq");
  const request = new Request(`https://volleytip.test${path}`);
  return route.loader({ request } as Parameters<typeof route.loader>[0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("preguntas frecuentes: ruta de /dev/", () => {
  it("pinta preguntas de muestra en español", async () => {
    const loaded = await loadDevFaq("test", "/dev/faq");

    expect(loaded).toMatchObject({ language: "es" });
    expect((loaded as { faqs: unknown[] }).faqs.length).toBeGreaterThan(1);
  });

  it("pinta preguntas de muestra en inglés", async () => {
    const loaded = await loadDevFaq("test", "/en/dev/faq");

    expect(loaded).toMatchObject({
      language: "en",
      faqs: [{ questionLanguage: "en" }, expect.anything(), expect.anything()],
    });
  });

  it("con estado=vacia no trae preguntas", async () => {
    const loaded = await loadDevFaq("test", "/dev/faq?estado=vacia");

    expect(loaded).toMatchObject({ faqs: [] });
  });

  it("en producción responde 404", async () => {
    await expect(loadDevFaq("production", "/dev/faq")).rejects.toMatchObject({
      init: { status: NOT_FOUND_STATUS },
    });
  });
});
