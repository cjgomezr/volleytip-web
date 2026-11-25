import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_SIGN_IN_FORM,
  handleSignInRequest,
  type SignInOutcome,
} from "~/lib/forms/admin-sign-in-form.server";
import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "~/lib/forms/field-names";
import { issueFormProtection } from "~/lib/forms/protected-form.server";
import { TURNSTILE_TEST_KEYS } from "~/lib/forms/turnstile-test-keys";
import { TURNSTILE_FIELD } from "~/lib/forms/turnstile.server";

import { TEST_ENV } from "../../../tests/support/test-env";
import { action } from "./sign-in";

const TEAM_EMAIL = "andres@prueba.volleytip.test";
const HUMAN_DELAY_MS = 4000;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;

interface Profile {
  readonly role: "admin" | "staff" | "buyer";
  readonly is_active: boolean;
}

interface Scenario {
  /** Los perfiles de la base, por correo. */
  readonly profiles?: Readonly<Record<string, Profile>>;
  readonly isWithinLimit?: boolean;
  /** Estado con que Auth responde al pedir el enlace. */
  readonly otpStatus?: number;
  /** Auth no contesta nada. */
  readonly isAuthDown?: boolean;
}

interface Recorded {
  readonly otpRequests: { url: URL; body: Record<string, unknown> }[];
  readonly profileReads: URL[];
  readonly rateLimitKeys: string[];
  readonly rejections: string[];
}

const TEAM: Readonly<Record<string, Profile>> = {
  [TEAM_EMAIL]: { role: "admin", is_active: true },
};

/** Un Supabase de mentira: la base de la protección, `profiles` y Auth. */
function stubBackend(scenario: Scenario = {}): Recorded {
  const { profiles = TEAM, isWithinLimit = true, otpStatus = 200 } = scenario;
  const recorded: Recorded = {
    otpRequests: [],
    profileReads: [],
    rateLimitKeys: [],
    rejections: [],
  };

  async function answerProtection(
    pathname: string,
    request: Request,
  ): Promise<Response> {
    const body = (await request.json()) as Record<string, string>;
    if (pathname.endsWith("/check_rate_limit")) {
      recorded.rateLimitKeys.push(body.p_key ?? "");
      return Response.json(isWithinLimit);
    }
    recorded.rejections.push(body.p_reason ?? "");
    return new Response(null, { status: 204 });
  }

  async function answerOtp(url: URL, request: Request): Promise<Response> {
    recorded.otpRequests.push({
      url,
      body: (await request.json()) as Record<string, unknown>,
    });
    return otpStatus === 200
      ? Response.json({})
      : Response.json(
          { code: otpStatus, error_code: "fallo", msg: "fallo" },
          { status: otpStatus },
        );
  }

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/auth/") && scenario.isAuthDown) {
      throw new TypeError("fetch failed");
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return answerProtection(url.pathname, request);
    }
    if (url.pathname === "/rest/v1/profiles") {
      recorded.profileReads.push(url);
      const email = url.searchParams.get("email")?.replace(/^eq\./, "") ?? "";
      const profile = profiles[email];
      return Response.json(profile === undefined ? [] : [profile]);
    }
    if (url.pathname === "/auth/v1/otp") return answerOtp(url, request);
    if (url.pathname === "/auth/v1/health") return Response.json({});
    throw new Error(`Petición inesperada: ${url.pathname}`);
  }

  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      answer(new Request(input, init)),
  );
  return recorded;
}

interface Submission {
  readonly email?: string;
  readonly path?: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly delayMs?: number;
}

function buildRequest({
  email = TEAM_EMAIL,
  path = "/admin/entrar",
  fields = {},
  delayMs = HUMAN_DELAY_MS,
}: Submission = {}): Request {
  const { timestamp } = issueFormProtection(ADMIN_SIGN_IN_FORM, {
    now: () => Date.now() - delayMs,
  });
  const body = new FormData();
  const entries = {
    email,
    [TIMESTAMP_FIELD]: timestamp,
    [TURNSTILE_FIELD]: TURNSTILE_TEST_KEYS.dummyToken,
    ...fields,
  };
  for (const [name, value] of Object.entries(entries)) body.set(name, value);
  return new Request(`http://localhost${path}`, { method: "POST", body });
}

async function submit(
  submission?: Submission,
): Promise<{ outcome: SignInOutcome; status: number }> {
  const response = await action({
    request: buildRequest(submission),
    context: new RouterContextProvider(),
    params: {},
  } as unknown as Parameters<typeof action>[0]);
  return { outcome: response.data, status: response.init?.status ?? 200 };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("entrada: pedir enlace", () => {
  it.each(["admin", "staff"] as const)(
    "el correo de un %s activo pide el enlace a Supabase sin crear usuarios",
    async (role) => {
      const backend = stubBackend({
        profiles: { [TEAM_EMAIL]: { role, is_active: true } },
      });

      const result = await submit();

      expect(result).toEqual({ outcome: { status: "sent" }, status: 200 });
      expect(backend.otpRequests).toHaveLength(1);
      // Sin `code_challenge`: el enlace no depende de una cookie del
      // navegador que lo pidió.
      expect(backend.otpRequests[0]?.body).toMatchObject({
        email: TEAM_EMAIL,
        create_user: false,
        code_challenge: null,
      });
    },
  );

  it.each<[string, Readonly<Record<string, Profile>>]>([
    ["un correo ajeno", {}],
    ["un buyer", { [TEAM_EMAIL]: { role: "buyer", is_active: true } }],
    ["un desactivado", { [TEAM_EMAIL]: { role: "admin", is_active: false } }],
  ])(
    "%s no pide el enlace y recibe la misma respuesta",
    async (_name, profiles) => {
      stubBackend();
      const forTeam = await submit();
      const backend = stubBackend({ profiles });

      const result = await submit();

      expect(backend.otpRequests).toEqual([]);
      expect(result).toEqual(forTeam);
    },
  );

  it("normaliza mayúsculas y espacios antes de buscar el correo", async () => {
    const backend = stubBackend();

    await submit({ email: `  ${TEAM_EMAIL.toUpperCase()}  ` });

    expect(backend.profileReads[0]?.searchParams.get("email")).toBe(
      `eq.${TEAM_EMAIL}`,
    );
    expect(backend.otpRequests[0]?.body.email).toBe(TEAM_EMAIL);
  });

  it.each(["", "   ", "andres@", "no es un correo"])(
    "el correo %j responde 400 con el error en el campo y conserva lo escrito",
    async (email) => {
      const backend = stubBackend();

      const result = await submit({ email });

      expect(result).toEqual({
        status: 400,
        outcome: {
          status: "invalid",
          fieldErrors: { email: "panel.signIn.error.email" },
          values: { email },
        },
      });
      expect(backend.otpRequests).toEqual([]);
    },
  );

  it("un correo demasiado largo responde 400", async () => {
    const backend = stubBackend();

    const result = await submit({ email: `${"a".repeat(250)}@x.co` });

    expect(result.status).toBe(400);
    expect(result.outcome).toMatchObject({
      fieldErrors: { email: "panel.signIn.error.emailTooLong" },
    });
    expect(backend.otpRequests).toEqual([]);
  });

  it("sin página pedida no manda dirección de regreso", async () => {
    const backend = stubBackend();

    await submit();

    expect(backend.otpRequests[0]?.url.searchParams.get("redirect_to")).toBe(
      null,
    );
  });

  it.each([
    ["%2Fadmin%2Fmensajes%3Fpage%3D2", "/admin/mensajes?page=2"],
    ["https%3A%2F%2Fsitio-ajeno.test", "/admin"],
  ])(
    "con next=%s manda como regreso una dirección de este sitio",
    async (next, path) => {
      const backend = stubBackend();

      await submit({ path: `/admin/entrar?next=${next}` });

      expect(backend.otpRequests[0]?.url.searchParams.get("redirect_to")).toBe(
        `${TEST_ENV.SITE_ORIGIN}${path}`,
      );
    },
  );

  it("si Supabase frena otro envío al mismo correo, responde igual", async () => {
    stubBackend({ otpStatus: TOO_MANY_REQUESTS });

    await expect(submit()).resolves.toEqual({
      outcome: { status: "sent" },
      status: 200,
    });
  });
});

describe("entrada: protección", () => {
  it.each([
    ["sin Turnstile", { fields: { [TURNSTILE_FIELD]: "" } }],
    ["demasiado rápido", { delayMs: 500 }],
  ] as const)("%s no envía", async (_name, submission) => {
    const backend = stubBackend();

    const result = await submit(submission);

    expect(result.status).toBe(400);
    expect(result.outcome.status).toBe("rejected");
    expect(backend.otpRequests).toEqual([]);
    expect(backend.profileReads).toEqual([]);
  });

  it("con el campo trampa lleno no envía y finge el éxito", async () => {
    const backend = stubBackend();

    const result = await submit({ fields: { [HONEYPOT_FIELD]: "bot" } });

    expect(result.outcome).toEqual({ status: "sent" });
    expect(backend.otpRequests).toEqual([]);
    expect(backend.rejections).toEqual(["honeypot"]);
  });

  it("superado el límite por IP lo dice y no envía", async () => {
    const backend = stubBackend({ isWithinLimit: false });

    const result = await submit();

    expect(result).toEqual({
      status: TOO_MANY_REQUESTS,
      outcome: { status: "rejected", reason: "rate_limited" },
    });
    expect(backend.otpRequests).toEqual([]);
  });

  it("cuenta el límite con su propia clave por IP", async () => {
    const backend = stubBackend();

    await submit();

    expect(backend.rateLimitKeys[0]).toMatch(/^admin_sign_in:/);
    expect(ADMIN_SIGN_IN_FORM.rateLimit.mode).toBe("block");
  });
});

describe("entrada: fallo de Supabase", () => {
  it.each<[string, Scenario]>([
    ["no contesta", { isAuthDown: true }],
    ["responde 500", { otpStatus: 500 }],
  ])("si Auth %s lo dice y conserva el correo", async (_name, scenario) => {
    stubBackend(scenario);

    await expect(submit()).resolves.toEqual({
      status: SERVICE_UNAVAILABLE,
      outcome: { status: "unavailable", values: { email: TEAM_EMAIL } },
    });
  });

  it("con Auth caído responde lo mismo a un correo ajeno", async () => {
    stubBackend({ isAuthDown: true });
    const forTeam = await submit();
    stubBackend({ isAuthDown: true, profiles: {} });

    const result = await submit();

    expect(result).toEqual(forTeam);
  });

  it.each<[string, Scenario]>([
    ["un correo del equipo", {}],
    ["un correo ajeno", { profiles: {} }],
  ])("deja de esperar a un Auth colgado con %s", async (_name, scenario) => {
    stubBackend(scenario);
    const request = buildRequest();
    const backendFetch = fetch;
    vi.stubGlobal(
      "fetch",
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (!String(input).includes("/auth/")) return backendFetch(input, init);
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("agotado", "TimeoutError"));
          });
        });
      },
    );

    const response = await handleSignInRequest(request, { authTimeoutMs: 20 });

    expect(response.data.status).toBe("unavailable");
  });

  it("deja registro del fallo sin el correo", async () => {
    stubBackend({ otpStatus: 500 });

    await submit();

    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      TEAM_EMAIL,
    );
  });
});
