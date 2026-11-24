import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProtectedFormResult } from "~/lib/forms/protected-form.server";
import { getCurrentLegalVersion } from "~/lib/legal/legal-documents";

const processProtectedForm = vi.fn();
vi.mock("~/lib/forms/protected-form.server", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/lib/forms/protected-form.server")
  >()),
  processProtectedForm: (...args: unknown[]): unknown =>
    processProtectedForm(...args),
}));
vi.mock("~/lib/waitlists.server", () => ({ joinWaitlist: vi.fn() }));
vi.mock("~/lib/site-stats.server", () => ({ readSiteStats: vi.fn() }));

const { joinWaitlist } = await import("~/lib/waitlists.server");
const { CAMP_NOTIFY_FORM } = await import("~/lib/camp-notify-form.server");
const { action } = await import("./home");

const OK = 200;
const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;

interface Submission {
  readonly status: number;
  readonly body: unknown;
}

async function submit(
  path: string,
  result: ProtectedFormResult<unknown>,
): Promise<Submission> {
  processProtectedForm.mockResolvedValue(result);
  const response = (await action({
    request: new Request(`http://localhost${path}`, { method: "POST" }),
    params: {},
    context: {},
  } as Parameters<typeof action>[0])) as unknown as {
    init: { status: number };
    data: unknown;
  };
  return { status: response.init.status, body: response.data };
}

function accepted(city: string | null): ProtectedFormResult<unknown> {
  return {
    status: "accepted",
    data: { email: "ana@example.com", city },
    overLimit: false,
  };
}

beforeEach(() => {
  vi.mocked(joinWaitlist).mockReset();
  processProtectedForm.mockReset();
});

describe("avísame: action", () => {
  it("inscribe con tipo, idioma, ciudad y versión de privacidad", async () => {
    const { status, body } = await submit("/en/", accepted("Cali"));

    expect(status).toBe(OK);
    expect(body).toEqual({ status: "joined" });
    expect(joinWaitlist).toHaveBeenCalledWith({
      kind: "camp_notify",
      email: "ana@example.com",
      locale: "en",
      countryCode: null,
      city: "Cali",
      privacyVersion: getCurrentLegalVersion("privacy"),
    });
  });

  it("inscribe sin ciudad cuando el campo llegó vacío", async () => {
    await submit("/", accepted(null));

    expect(joinWaitlist).toHaveBeenCalledWith(
      expect.objectContaining({ city: null, locale: "es" }),
    );
  });

  it("responde 400 con el error traducido y lo escrito cuando el correo es inválido", async () => {
    const { status, body } = await submit("/", {
      status: "invalid",
      fieldErrors: { email: "notify.error.email" },
      formErrors: [],
      values: { email: "mal", city: "Cali" },
    });

    expect(status).toBe(BAD_REQUEST);
    expect(body).toEqual({
      status: "invalid",
      fieldErrors: { email: "Escribe un correo válido" },
      values: { email: "mal", city: "Cali" },
    });
    expect(joinWaitlist).not.toHaveBeenCalled();
  });

  it("confirma igual cuando el correo ya estaba en la lista", async () => {
    // `joinWaitlist` responde lo mismo para correos nuevos y repetidos.
    const first = await submit("/", accepted(null));
    const second = await submit("/", accepted(null));

    expect(second).toEqual(first);
  });
});

describe("avísame: esquema", () => {
  function parse(input: Record<string, string>): { success: boolean } {
    return CAMP_NOTIFY_FORM.schema.safeParse(input);
  }

  it("acepta un correo con ciudad y los recorta", () => {
    expect(
      CAMP_NOTIFY_FORM.schema.safeParse({
        email: " ana@example.com ",
        city: " Cali ",
      }),
    ).toMatchObject({
      success: true,
      data: { email: "ana@example.com", city: "Cali" },
    });
  });

  it("guarda sin ciudad cuando el campo está vacío", () => {
    expect(
      CAMP_NOTIFY_FORM.schema.safeParse({ email: "ana@example.com", city: "" }),
    ).toMatchObject({ success: true, data: { city: null } });
  });

  it("rechaza un correo vacío o inválido", () => {
    expect(parse({ email: "", city: "" }).success).toBe(false);
    expect(parse({ email: "mal", city: "" }).success).toBe(false);
  });

  it("rechaza una ciudad de más de 80 caracteres y acepta una de 80", () => {
    expect(
      parse({ email: "ana@example.com", city: "x".repeat(81) }).success,
    ).toBe(false);
    expect(
      parse({ email: "ana@example.com", city: "x".repeat(80) }).success,
    ).toBe(true);
  });
});

describe("avísame: protección", () => {
  it.each(["too_fast", "verification_failed"] as const)(
    "con %s no inscribe y avisa",
    async (status) => {
      const outcome = await submit("/", { status });

      expect(outcome.status).toBe(BAD_REQUEST);
      expect(joinWaitlist).not.toHaveBeenCalled();
    },
  );

  it("con el campo trampa lleno no inscribe y responde como éxito", async () => {
    const outcome = await submit("/", { status: "discarded" });

    expect(outcome.body).toEqual({ status: "joined" });
    expect(joinWaitlist).not.toHaveBeenCalled();
  });

  it("rechaza con un mensaje al pasar el límite por IP", async () => {
    const outcome = await submit("/", { status: "rate_limited" });

    expect(outcome.status).toBe(TOO_MANY_REQUESTS);
    expect(outcome.body).toMatchObject({ status: "rejected" });
    expect(joinWaitlist).not.toHaveBeenCalled();
  });

  it("usa el límite de 5 envíos cada 10 minutos", () => {
    expect(CAMP_NOTIFY_FORM.rateLimit).toMatchObject({
      maxAttempts: 5,
      windowSeconds: 600,
      mode: "block",
    });
  });
});
