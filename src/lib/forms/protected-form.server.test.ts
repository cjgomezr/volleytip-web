import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "./field-names";
import type { FormStore, RejectionReason } from "./form-store.server";
import {
  DEFAULT_RATE_LIMIT,
  defineProtectedForm,
  issueFormProtection,
  processProtectedForm,
  type ProtectedForm,
  type ProtectedFormResult,
} from "./protected-form.server";
import { TURNSTILE_TEST_KEYS } from "./turnstile-test-keys";
import { TURNSTILE_FIELD } from "./turnstile.server";

const RENDERED_AT = Date.UTC(2026, 10, 20, 15, 0, 0);
const SECOND_MS = 1000;
const HOUR_MS = 60 * 60 * SECOND_MS;
const HUMAN_DELAY_MS = 4 * SECOND_MS;
const BOT_DELAY_MS = 2 * SECOND_MS;
const VISITOR_IP = "203.0.113.7";
const MAX_NAME_LENGTH = 80;
const HUGE_INPUT_LENGTH = 1_000_000;
const NAME_TOO_LONG = "El nombre es demasiado largo";
const EMAIL_INVALID = "Escribe un correo válido";

const ENV = buildTestServerEnv();
const STAGING_ENV = buildTestServerEnv({
  appEnv: "staging",
  turnstileSecretKey: "0x4AAAAAAA-llave-secreta-de-mentira",
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH, NAME_TOO_LONG),
  email: z.email(EMAIL_INVALID),
});
type Contact = z.infer<typeof contactSchema>;

const CONTACT_FORM = defineProtectedForm({
  id: "prueba_contacto",
  schema: contactSchema,
});

interface FakeStore extends FormStore {
  readonly rejections: { form: string; reason: RejectionReason }[];
  readonly limitCalls: { key: string; maxAttempts: number }[];
}

/** Guarda en memoria lo que la base guardaría, con la misma regla: cada
 * llamada cuenta, y se permite mientras el conteo no pase del máximo. */
function createFakeStore(): FakeStore {
  const counts = new Map<string, number>();
  const store: FakeStore = {
    rejections: [],
    limitCalls: [],
    checkRateLimit({ key, maxAttempts }) {
      store.limitCalls.push({ key, maxAttempts });
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return Promise.resolve(count <= maxAttempts);
    },
    recordRejection(form, reason) {
      store.rejections.push({ form, reason });
      return Promise.resolve();
    },
  };
  return store;
}

interface Submission {
  readonly form?: ProtectedForm<Contact>;
  readonly fields?: Record<string, string>;
  /** Cuánto tardó la persona entre ver el formulario y enviarlo. */
  readonly delayMs?: number;
  readonly ip?: string;
  readonly store?: FormStore;
  readonly fetch?: typeof fetch;
  readonly env?: typeof ENV;
}

const VALID_FIELDS = { name: "Ana", email: "ana@ejemplo.co" };

function buildRequest(fields: Record<string, string>, ip: string): Request {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return new Request("https://volleytip.test/contacto", {
    method: "POST",
    headers: { "X-Forwarded-For": ip },
    body,
  });
}

function forbiddenFetch(): Promise<Response> {
  throw new Error("Esta prueba no debía llamar a Cloudflare");
}

/** Envía el formulario como lo haría un navegador: con la marca que emitió
 * el servidor y el token que deja el widget de prueba. */
async function submit({
  form = CONTACT_FORM,
  fields = {},
  delayMs = HUMAN_DELAY_MS,
  ip = VISITOR_IP,
  store = createFakeStore(),
  fetch: fetchImplementation = forbiddenFetch,
  env = ENV,
}: Submission = {}): Promise<ProtectedFormResult<Contact>> {
  const { timestamp } = issueFormProtection(form, {
    env,
    now: () => RENDERED_AT,
  });
  const request = buildRequest(
    {
      ...VALID_FIELDS,
      [TIMESTAMP_FIELD]: timestamp,
      [TURNSTILE_FIELD]: TURNSTILE_TEST_KEYS.dummyToken,
      ...fields,
    },
    ip,
  );
  return processProtectedForm(request, form, {
    env,
    now: () => RENDERED_AT + delayMs,
    fetch: fetchImplementation,
    store,
  });
}

describe("formulario protegido: aceptado", () => {
  it("devuelve los datos validados y tipados", async () => {
    const result = await submit({ fields: { name: "  Ana  " } });

    expect(result).toEqual({
      status: "accepted",
      data: { name: "Ana", email: "ana@ejemplo.co" },
      overLimit: false,
    });
  });

  it("no suma ningún rechazo", async () => {
    const store = createFakeStore();

    await submit({ store });

    expect(store.rejections).toEqual([]);
  });

  it("los datos no traen los campos de la protección", async () => {
    const openSchema = z.looseObject({ name: z.string() });
    const form = defineProtectedForm({
      id: "prueba_abierto",
      schema: openSchema,
    });
    const { timestamp } = issueFormProtection(form, {
      env: ENV,
      now: () => RENDERED_AT,
    });
    const request = buildRequest(
      {
        name: "Ana",
        [HONEYPOT_FIELD]: "",
        [TIMESTAMP_FIELD]: timestamp,
        [TURNSTILE_FIELD]: TURNSTILE_TEST_KEYS.dummyToken,
      },
      VISITOR_IP,
    );

    const result = await processProtectedForm(request, form, {
      env: ENV,
      now: () => RENDERED_AT + HUMAN_DELAY_MS,
      store: createFakeStore(),
    });

    expect(result).toMatchObject({ status: "accepted", data: { name: "Ana" } });
    expect(
      result.status === "accepted" ? Object.keys(result.data) : [],
    ).toEqual(["name"]);
  });
});

describe("formulario protegido: una prueba por variante", () => {
  const rejected: readonly {
    status: string;
    reason: RejectionReason;
    submission: Submission;
  }[] = [
    {
      status: "discarded",
      reason: "honeypot",
      submission: { fields: { [HONEYPOT_FIELD]: "https://spam.test" } },
    },
    {
      status: "too_fast",
      reason: "too_fast",
      submission: { delayMs: BOT_DELAY_MS },
    },
    {
      status: "verification_failed",
      reason: "turnstile",
      submission: { fields: { [TURNSTILE_FIELD]: "token-inventado" } },
    },
    {
      status: "invalid",
      reason: "validation",
      submission: { fields: { email: "no-es-un-correo" } },
    },
  ];

  it.each(rejected)(
    "$status suma un rechazo con motivo $reason",
    async ({ status, reason, submission }) => {
      const store = createFakeStore();

      const result = await submit({ ...submission, store });

      expect(result.status).toBe(status);
      expect(store.rejections).toEqual([{ form: CONTACT_FORM.id, reason }]);
    },
  );

  it("rate_limited suma un rechazo con motivo rate_limit", async () => {
    const store = createFakeStore();
    for (let sent = 0; sent < DEFAULT_RATE_LIMIT.maxAttempts; sent += 1) {
      await submit({ store });
    }

    const result = await submit({ store });

    expect(result).toEqual({ status: "rate_limited" });
    expect(store.rejections).toEqual([
      { form: CONTACT_FORM.id, reason: "rate_limit" },
    ]);
  });
});

describe("marca de tiempo", () => {
  it("a los 2 segundos es too_fast y a los 4 pasa", async () => {
    const tooFast = await submit({ delayMs: BOT_DELAY_MS });
    const human = await submit({ delayMs: HUMAN_DELAY_MS });

    expect(tooFast).toEqual({ status: "too_fast" });
    expect(human.status).toBe("accepted");
  });

  it.each([
    ["alterada", { [TIMESTAMP_FIELD]: `${String(RENDERED_AT)}.firma-falsa` }],
    ["ausente", { [TIMESTAMP_FIELD]: "" }],
  ])("una marca %s es too_fast", async (_case, fields) => {
    const result = await submit({ fields });

    expect(result).toEqual({ status: "too_fast" });
  });

  it("una marca con más de 24 horas es too_fast", async () => {
    const result = await submit({ delayMs: 25 * HOUR_MS });

    expect(result).toEqual({ status: "too_fast" });
  });

  it("una marca de otro formulario es too_fast", async () => {
    const other = defineProtectedForm({
      id: "prueba_otro",
      schema: contactSchema,
    });
    const { timestamp } = issueFormProtection(other, {
      env: ENV,
      now: () => RENDERED_AT,
    });

    const result = await submit({ fields: { [TIMESTAMP_FIELD]: timestamp } });

    expect(result).toEqual({ status: "too_fast" });
  });

  it("un cuerpo que no es un formulario es too_fast", async () => {
    const store = createFakeStore();
    const request = new Request("https://volleytip.test/contacto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const result = await processProtectedForm(request, CONTACT_FORM, {
      env: ENV,
      now: () => RENDERED_AT,
      store,
    });

    expect(result).toEqual({ status: "too_fast" });
  });
});

describe("Turnstile", () => {
  it("sin token es verification_failed y no trae datos", async () => {
    const result = await submit({ fields: { [TURNSTILE_FIELD]: "" } });

    expect(result).toEqual({ status: "verification_failed" });
  });

  it("un token que Cloudflare rechaza es verification_failed", async () => {
    const rejecting = vi.fn(() =>
      Promise.resolve(Response.json({ success: false })),
    );

    const result = await submit({ env: STAGING_ENV, fetch: rejecting });

    expect(rejecting).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "verification_failed" });
  });

  it("un token que Cloudflare acepta pasa la capa", async () => {
    const accepting = vi.fn(() =>
      Promise.resolve(Response.json({ success: true })),
    );

    const result = await submit({ env: STAGING_ENV, fetch: accepting });

    expect(result.status).toBe("accepted");
  });
});

describe("orden de las capas", () => {
  it("con la trampa llena no llama a Cloudflare ni gasta cupo", async () => {
    const store = createFakeStore();
    const cloudflare = vi.fn(forbiddenFetch);

    const result = await submit({
      env: STAGING_ENV,
      fetch: cloudflare,
      store,
      fields: { [HONEYPOT_FIELD]: "lleno" },
    });

    expect(result).toEqual({ status: "discarded" });
    expect(cloudflare).not.toHaveBeenCalled();
    expect(store.limitCalls).toEqual([]);
  });

  it("demasiado rápido tampoco llama a Cloudflare ni gasta cupo", async () => {
    const store = createFakeStore();
    const cloudflare = vi.fn(forbiddenFetch);

    const result = await submit({
      env: STAGING_ENV,
      fetch: cloudflare,
      store,
      delayMs: BOT_DELAY_MS,
    });

    expect(result).toEqual({ status: "too_fast" });
    expect(cloudflare).not.toHaveBeenCalled();
    expect(store.limitCalls).toEqual([]);
  });

  it("si Turnstile falla no gasta cupo", async () => {
    const store = createFakeStore();

    await submit({ store, fields: { [TURNSTILE_FIELD]: "token-inventado" } });

    expect(store.limitCalls).toEqual([]);
  });

  const doubleFailures: readonly (readonly [string, Submission, string])[] = [
    [
      "trampa antes que tiempo",
      { fields: { [HONEYPOT_FIELD]: "lleno" }, delayMs: BOT_DELAY_MS },
      "discarded",
    ],
    [
      "tiempo antes que Turnstile",
      { fields: { [TURNSTILE_FIELD]: "" }, delayMs: BOT_DELAY_MS },
      "too_fast",
    ],
    [
      "Turnstile antes que validación",
      { fields: { [TURNSTILE_FIELD]: "", email: "malo" } },
      "verification_failed",
    ],
  ];

  it.each(doubleFailures)(
    "con dos fallos gana la primera capa: %s",
    async (_case, submission, expected) => {
      const result = await submit(submission);

      expect(result.status).toBe(expected);
    },
  );

  it("el límite va antes que la validación", async () => {
    const store = createFakeStore();
    for (let sent = 0; sent < DEFAULT_RATE_LIMIT.maxAttempts; sent += 1) {
      await submit({ store });
    }

    const result = await submit({ store, fields: { email: "malo" } });

    expect(result).toEqual({ status: "rate_limited" });
  });
});

describe("límite por IP", () => {
  async function sendAccepted(store: FormStore, times: number): Promise<void> {
    for (let sent = 0; sent < times; sent += 1) {
      const result = await submit({ store });
      expect(result.status).toBe("accepted");
    }
  }

  it("por defecto son 5 envíos en 10 minutos", () => {
    expect(DEFAULT_RATE_LIMIT).toEqual({
      maxAttempts: 5,
      windowSeconds: 600,
      mode: "block",
    });
  });

  it("el sexto envío en la ventana se rechaza", async () => {
    const store = createFakeStore();
    await sendAccepted(store, DEFAULT_RATE_LIMIT.maxAttempts);

    const sixth = await submit({ store });

    expect(sixth).toEqual({ status: "rate_limited" });
  });

  it("otro formulario no se ve afectado", async () => {
    const store = createFakeStore();
    const other = defineProtectedForm({
      id: "prueba_otro",
      schema: contactSchema,
    });
    await sendAccepted(store, DEFAULT_RATE_LIMIT.maxAttempts);

    const result = await submit({ store, form: other });

    expect(result.status).toBe("accepted");
  });

  it("otra IP tampoco", async () => {
    const store = createFakeStore();
    await sendAccepted(store, DEFAULT_RATE_LIMIT.maxAttempts);

    const result = await submit({ store, ip: "198.51.100.20" });

    expect(result.status).toBe("accepted");
  });

  it("la clave del límite no lleva la IP en claro", async () => {
    const store = createFakeStore();

    await submit({ store });

    expect(store.limitCalls).toHaveLength(1);
    expect(store.limitCalls[0]?.key).toMatch(/^prueba_contacto:[0-9a-f]{64}$/);
    expect(store.limitCalls[0]?.key).not.toContain(VISITOR_IP);
  });

  it("sin la cabecera de IP en staging lanza: no hay IP por defecto", async () => {
    const { timestamp } = issueFormProtection(CONTACT_FORM, {
      env: STAGING_ENV,
      now: () => RENDERED_AT,
    });
    const body = new FormData();
    body.set(TIMESTAMP_FIELD, timestamp);
    body.set(TURNSTILE_FIELD, "un-token");
    const request = new Request("https://volleytip.test/contacto", {
      method: "POST",
      body,
    });

    const processing = processProtectedForm(request, CONTACT_FORM, {
      env: STAGING_ENV,
      now: () => RENDERED_AT + HUMAN_DELAY_MS,
      fetch: () => Promise.resolve(Response.json({ success: true })),
      store: createFakeStore(),
    });

    await expect(processing).rejects.toThrow(/CLIENT_IP_HEADER/);
  });

  it("sin la cabecera de IP en local usa la de la propia máquina", async () => {
    const { timestamp } = issueFormProtection(CONTACT_FORM, {
      env: ENV,
      now: () => RENDERED_AT,
    });
    const body = new FormData();
    body.set("name", "Ana");
    body.set("email", "ana@ejemplo.co");
    body.set(TIMESTAMP_FIELD, timestamp);
    body.set(TURNSTILE_FIELD, TURNSTILE_TEST_KEYS.dummyToken);
    const request = new Request("https://volleytip.test/contacto", {
      method: "POST",
      body,
    });

    const result = await processProtectedForm(request, CONTACT_FORM, {
      env: ENV,
      now: () => RENDERED_AT + HUMAN_DELAY_MS,
      store: createFakeStore(),
    });

    expect(result.status).toBe("accepted");
  });
});

describe("modo flag", () => {
  const FLAG_LIMIT = {
    maxAttempts: 2,
    windowSeconds: 3600,
    mode: "flag",
  } as const;
  const FLAG_FORM = defineProtectedForm({
    id: "prueba_tour",
    schema: contactSchema,
    rateLimit: FLAG_LIMIT,
  });

  it("sobre el límite devuelve accepted con overLimit y no suma un rechazo", async () => {
    const store = createFakeStore();
    await submit({ store, form: FLAG_FORM });
    await submit({ store, form: FLAG_FORM });

    const third = await submit({ store, form: FLAG_FORM });

    expect(third).toMatchObject({ status: "accepted", overLimit: true });
    expect(store.rejections).toEqual([]);
  });

  it("bajo el límite overLimit es false", async () => {
    const result = await submit({ form: FLAG_FORM });

    expect(result).toMatchObject({ status: "accepted", overLimit: false });
  });

  it("usa el límite propio del formulario", async () => {
    const store = createFakeStore();

    await submit({ store, form: FLAG_FORM });

    expect(store.limitCalls[0]?.maxAttempts).toBe(FLAG_LIMIT.maxAttempts);
  });
});

describe("validación", () => {
  it("un campo demasiado largo trae su error y los valores recibidos", async () => {
    const longName = "a".repeat(MAX_NAME_LENGTH + 1);

    const result = await submit({ fields: { name: longName } });

    expect(result).toEqual({
      status: "invalid",
      fieldErrors: { name: NAME_TOO_LONG },
      formErrors: [],
      values: { name: longName, email: "ana@ejemplo.co" },
    });
  });

  it("un formato inválido trae el error de ese campo", async () => {
    const result = await submit({ fields: { email: "no-es-un-correo" } });

    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: { email: EMAIL_INVALID },
    });
  });

  it("un campo obligatorio ausente trae su error", async () => {
    const form = defineProtectedForm({
      id: "prueba_contacto",
      schema: contactSchema.extend({ phone: z.string().min(7) }),
    });

    const result = await submit({ form });

    expect(result.status).toBe("invalid");
    expect(
      result.status === "invalid" ? Object.keys(result.fieldErrors) : [],
    ).toEqual(["phone"]);
  });

  it("una entrada enorme es inválida y no se devuelve entera", async () => {
    const result = await submit({
      fields: { name: "a".repeat(HUGE_INPUT_LENGTH) },
    });

    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: { name: NAME_TOO_LONG },
    });
    expect(
      result.status === "invalid" ? result.values.name?.length : undefined,
    ).toBeLessThan(HUGE_INPUT_LENGTH);
  });

  it("los valores devueltos no traen los campos de la protección", async () => {
    const result = await submit({ fields: { email: "malo" } });

    expect(
      result.status === "invalid" ? Object.keys(result.values).sort() : [],
    ).toEqual(["email", "name"]);
  });

  it("un archivo en un campo de texto no llega al esquema", async () => {
    const { timestamp } = issueFormProtection(CONTACT_FORM, {
      env: ENV,
      now: () => RENDERED_AT,
    });
    const body = new FormData();
    body.set("name", new File(["contenido"], "nombre.txt"));
    body.set("email", "ana@ejemplo.co");
    body.set(TIMESTAMP_FIELD, timestamp);
    body.set(TURNSTILE_FIELD, TURNSTILE_TEST_KEYS.dummyToken);
    const request = new Request("https://volleytip.test/contacto", {
      method: "POST",
      headers: { "X-Forwarded-For": VISITOR_IP },
      body,
    });

    const result = await processProtectedForm(request, CONTACT_FORM, {
      env: ENV,
      now: () => RENDERED_AT + HUMAN_DELAY_MS,
      store: createFakeStore(),
    });

    expect(result).toMatchObject({ status: "invalid" });
    expect(
      result.status === "invalid" ? Object.keys(result.fieldErrors) : [],
    ).toEqual(["name"]);
  });
});

describe("dependencias caídas", () => {
  it("Cloudflare caído da verification_failed", async () => {
    const down = (): Promise<Response> =>
      Promise.reject(new TypeError("fetch failed"));

    const result = await submit({ env: STAGING_ENV, fetch: down });

    expect(result).toEqual({ status: "verification_failed" });
  });

  it("la base caída al consultar el límite lanza", async () => {
    const store: FormStore = {
      ...createFakeStore(),
      checkRateLimit: () => Promise.reject(new Error("base caída")),
    };

    await expect(submit({ store })).rejects.toThrow("base caída");
  });

  it("la base caída al contar un rechazo lanza", async () => {
    const store: FormStore = {
      ...createFakeStore(),
      recordRejection: () => Promise.reject(new Error("base caída")),
    };

    await expect(submit({ store, delayMs: BOT_DELAY_MS })).rejects.toThrow(
      "base caída",
    );
  });
});

describe("definición del formulario", () => {
  it.each(["Contacto", "con-guion", "", "1contacto", "a".repeat(41)])(
    "rechaza el identificador %j",
    (id) => {
      expect(() => defineProtectedForm({ id, schema: contactSchema })).toThrow(
        /identificador/,
      );
    },
  );

  it.each([
    { maxAttempts: 0, windowSeconds: 600, mode: "block" },
    { maxAttempts: 5, windowSeconds: 0, mode: "block" },
    { maxAttempts: 1.5, windowSeconds: 600, mode: "block" },
  ] as const)("rechaza el límite %j", (rateLimit) => {
    expect(() =>
      defineProtectedForm({ id: "prueba", schema: contactSchema, rateLimit }),
    ).toThrow(/límite/);
  });

  it("lo que el loader entrega es la llave de sitio y la marca firmada", () => {
    const fields = issueFormProtection(CONTACT_FORM, {
      env: ENV,
      now: () => RENDERED_AT,
    });

    expect(fields.siteKey).toBe(ENV.turnstileSiteKey);
    expect(fields.timestamp.startsWith(`${String(RENDERED_AT)}.`)).toBe(true);
    expect(Object.keys(fields).sort()).toEqual(["siteKey", "timestamp"]);
  });
});

describe("tipos", () => {
  it("los datos no se pueden leer sin estrechar a accepted", async () => {
    const result = await submit();

    // @ts-expect-error -- `data` solo existe en la variante `accepted`
    const unchecked: unknown = result.data;

    expect(unchecked).toBeDefined();
    if (result.status === "accepted") {
      const checked: Contact = result.data;
      expect(checked.name).toBe("Ana");
    }
  });
});
