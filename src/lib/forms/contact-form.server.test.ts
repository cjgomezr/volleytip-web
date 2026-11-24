import { describe, expect, it } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { getCurrentLegalVersion } from "../legal/legal-documents";
import type { MessageEntry } from "../messages.server";

import {
  CONTACT_FORM,
  handleContactSubmission,
  type ContactSubmissionDependencies,
} from "./contact-form.server";
import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "./field-names";
import type { FormStore } from "./form-store.server";
import { issueFormProtection } from "./protected-form.server";
import { TURNSTILE_TEST_KEYS } from "./turnstile-test-keys";
import { TURNSTILE_FIELD } from "./turnstile.server";

const RENDERED_AT = Date.UTC(2026, 10, 20, 15, 0, 0);
const SECOND_MS = 1000;
const HUMAN_DELAY_MS = 4 * SECOND_MS;
const BOT_DELAY_MS = 2 * SECOND_MS;
const ENV = buildTestServerEnv();
const MAX_ATTEMPTS = 5;
const MAX_MESSAGE_LENGTH = 2000;

interface Harness {
  readonly saved: MessageEntry[];
  readonly dependencies: ContactSubmissionDependencies & {
    readonly protection: NonNullable<
      ContactSubmissionDependencies["protection"]
    >;
  };
}

function createHarness(): Harness {
  const counts = new Map<string, number>();
  const store: FormStore = {
    checkRateLimit: ({ key, maxAttempts }) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return Promise.resolve(count <= maxAttempts);
    },
    recordRejection: () => Promise.resolve(),
  };
  const saved: MessageEntry[] = [];
  return {
    saved,
    dependencies: {
      protection: {
        env: ENV,
        now: () => RENDERED_AT + HUMAN_DELAY_MS,
        fetch: () => {
          throw new Error("Esta prueba no debía llamar a Cloudflare");
        },
        store,
      },
      save: (entry) => {
        saved.push(entry);
        return Promise.resolve();
      },
    },
  };
}

function buildRequest(
  fields: Record<string, string>,
  { path = "/contacto", withToken = true } = {},
): Request {
  const { timestamp } = issueFormProtection(CONTACT_FORM, {
    env: ENV,
    now: () => RENDERED_AT,
  });
  const body = new FormData();
  const all: Record<string, string> = {
    reason: "otro",
    name: "Ana Pérez",
    email: "ana@ejemplo.co",
    country: "CO",
    message: "Hola, quiero saber más.",
    [TIMESTAMP_FIELD]: timestamp,
    ...(withToken ? { [TURNSTILE_FIELD]: TURNSTILE_TEST_KEYS.dummyToken } : {}),
    ...fields,
  };
  for (const [name, value] of Object.entries(all)) body.set(name, value);
  return new Request(`https://volleytip.test${path}`, {
    method: "POST",
    headers: { "X-Forwarded-For": "203.0.113.7" },
    body,
  });
}

async function submit(
  fields: Record<string, string>,
  options?: { path?: string; withToken?: boolean },
): Promise<{
  readonly response: Awaited<ReturnType<typeof handleContactSubmission>>;
  readonly saved: MessageEntry[];
}> {
  const { saved, dependencies } = createHarness();
  const response = await handleContactSubmission(
    buildRequest(fields, options),
    dependencies,
  );
  return { response, saved };
}

describe("contacto: action", () => {
  it("un envío válido guarda motivo, idioma, país, mensaje y versión de la política", async () => {
    const { response, saved } = await submit({
      reason: "otro",
      name: " Ana Pérez ",
      country: "MX",
      message: "Hola",
    });

    expect(response.init?.status).toBe(200);
    expect(response.data).toEqual({ status: "sent" });
    expect(saved).toEqual([
      {
        reason: "other",
        name: "Ana Pérez",
        email: "ana@ejemplo.co",
        whatsapp: null,
        countryCode: "MX",
        body: "Hola",
        payload: {},
        locale: "es",
        privacyVersion: getCurrentLegalVersion("privacy"),
      },
    ]);
  });

  it("toma el idioma de la página", async () => {
    const { saved } = await submit({}, { path: "/en/contact" });

    expect(saved[0]?.locale).toBe("en");
  });

  it("el motivo 'Camps y VBall Tour' se guarda como camps", async () => {
    const { saved } = await submit({ reason: "camps" });

    expect(saved[0]?.reason).toBe("camps");
  });

  it("'Sugerir un tip' se guarda como suggest_tip", async () => {
    const { saved } = await submit({ reason: "tip" });

    expect(saved[0]?.reason).toBe("suggest_tip");
  });

  it("un pedido guarda el número de pedido en el payload", async () => {
    const { saved } = await submit({
      reason: "pedido",
      orderNumber: " VT-1024 ",
    });

    expect(saved[0]).toMatchObject({
      reason: "order",
      payload: { orderNumber: "VT-1024" },
    });
  });

  it("marcas guarda la marca o club en el payload", async () => {
    const { saved } = await submit({ reason: "marcas", brand: "Club Cali" });

    expect(saved[0]).toMatchObject({
      reason: "brands",
      payload: { brand: "Club Cali" },
    });
  });

  it("un motivo desconocido se guarda como other", async () => {
    const { saved } = await submit({ reason: "pizza" });

    expect(saved[0]?.reason).toBe("other");
  });

  it("descarta los campos que el formulario no espera", async () => {
    const { saved } = await submit({
      reason: "otro",
      orderNumber: "VT-1",
      brand: "Marca",
      role: "admin",
      status: "answered",
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.payload).toEqual({});
    expect(saved[0]).not.toHaveProperty("role");
    expect(saved[0]).not.toHaveProperty("status");
  });

  it("no mezcla los campos de otro motivo", async () => {
    const { saved } = await submit({
      reason: "pedido",
      orderNumber: "VT-1",
      brand: "Marca",
    });

    expect(saved[0]?.payload).toEqual({ orderNumber: "VT-1" });
  });
});

describe("contacto: validación", () => {
  it.each([
    ["nombre vacío", { name: "  " }, "name"],
    ["nombre de más de 120 caracteres", { name: "a".repeat(121) }, "name"],
    ["correo vacío", { email: "" }, "email"],
    ["correo inválido", { email: "no-es-correo" }, "email"],
    ["mensaje vacío", { message: "   " }, "message"],
    [
      "mensaje de más de 2.000 caracteres",
      { message: "a".repeat(MAX_MESSAGE_LENGTH + 1) },
      "message",
    ],
    ["país fuera de la lista", { country: "ZZ" }, "country"],
    [
      "pedido sin número de pedido",
      { reason: "pedido", orderNumber: "" },
      "orderNumber",
    ],
    ["marcas sin marca o club", { reason: "marcas", brand: " " }, "brand"],
  ])(
    "%s responde 400 con el error en su campo",
    async (_name, fields, field) => {
      const { response, saved } = await submit(fields);

      expect(response.init?.status).toBe(400);
      expect(response.data).toMatchObject({
        status: "invalid",
        fieldErrors: { [field]: expect.any(String) },
      });
      expect(saved).toEqual([]);
    },
  );

  it("acepta un mensaje de exactamente 2.000 caracteres", async () => {
    const { saved } = await submit({
      message: "a".repeat(MAX_MESSAGE_LENGTH),
    });

    expect(saved).toHaveLength(1);
  });

  it("el número de pedido solo es obligatorio con su motivo", async () => {
    const { saved } = await submit({ reason: "camps", orderNumber: "" });

    expect(saved).toHaveLength(1);
  });

  it("marca cada error junto a su campo y conserva lo escrito", async () => {
    const { response } = await submit({
      reason: "pedido",
      name: "",
      email: "mal",
      orderNumber: "",
      message: "Mi pedido no llegó",
    });

    expect(response.data).toMatchObject({
      status: "invalid",
      fieldErrors: {
        name: expect.any(String),
        email: expect.any(String),
        orderNumber: expect.any(String),
      },
      values: { email: "mal", message: "Mi pedido no llegó", reason: "pedido" },
    });
  });
});

describe("contacto: protección", () => {
  it("sin verificación de Turnstile no guarda nada", async () => {
    const { saved, dependencies } = createHarness();
    const stagingEnv = buildTestServerEnv({
      appEnv: "staging",
      turnstileSecretKey: "0x4AAAAAAA-llave-secreta-de-mentira",
    });

    const response = await handleContactSubmission(
      buildRequest({}, { withToken: false }),
      {
        ...dependencies,
        protection: {
          ...dependencies.protection,
          env: stagingEnv,
          fetch: () => Promise.resolve(Response.json({ success: false })),
        },
      },
    );

    expect(response.init?.status).toBe(400);
    expect(response.data).toEqual({
      status: "rejected",
      reason: "verification_failed",
    });
    expect(saved).toEqual([]);
  });

  it("con el campo trampa lleno no guarda y confirma como si hubiera salido bien", async () => {
    const { saved, dependencies } = createHarness();
    const request = buildRequest({ [HONEYPOT_FIELD]: "https://spam.example" });

    const response = await handleContactSubmission(request, dependencies);

    expect(response.data).toEqual({ status: "sent" });
    expect(saved).toEqual([]);
  });

  it("hecho en menos de 3 segundos no guarda nada", async () => {
    const { saved, dependencies } = createHarness();

    const response = await handleContactSubmission(buildRequest({}), {
      ...dependencies,
      protection: {
        ...dependencies.protection,
        now: () => RENDERED_AT + BOT_DELAY_MS,
      },
    });

    expect(response.init?.status).toBe(400);
    expect(response.data).toEqual({ status: "rejected", reason: "too_fast" });
    expect(saved).toEqual([]);
  });

  it("el sexto envío desde la misma IP se rechaza y no se guarda", async () => {
    const { saved, dependencies } = createHarness();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await handleContactSubmission(buildRequest({}), dependencies);
    }
    const sixth = await handleContactSubmission(buildRequest({}), dependencies);

    expect(saved).toHaveLength(MAX_ATTEMPTS);
    expect(sixth.init?.status).toBe(429);
    expect(sixth.data).toEqual({ status: "rejected", reason: "rate_limited" });
  });
});
