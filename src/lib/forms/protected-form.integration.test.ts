import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import { createServiceSupabaseClient } from "~/lib/supabase/service-client.server";
import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createLocalServiceClient } from "~/testing/local-supabase.server";
import { buildTestServerEnv } from "~/testing/test-server-env";

import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "./field-names";
import { createSupabaseFormStore, type FormStore } from "./form-store.server";
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

interface Contact {
  readonly name: string;
}

interface RejectionRow {
  readonly reason: string;
  readonly count: number;
}

interface Submission {
  readonly fields?: Record<string, string>;
  readonly delayMs?: number;
  readonly ip?: string;
}

const ENV = buildTestServerEnv();
const RENDERED_AT = Date.UTC(2026, 10, 20, 15, 0, 0);
const HUMAN_DELAY_MS = 4000;
const BOT_DELAY_MS = 2000;
const VISITOR_IP = "203.0.113.7";
const SUBMITTED_NAME = "Ana Secreta";
// Las filas de prueba llevan este prefijo para borrarlas sin tocar otras.
const TEST_FORM_PREFIX = "prueba_pf_";
const contactSchema = z.object({ name: z.string().min(1).max(40) });

let database: Database;
let store: FormStore;

function buildTestForm(rateLimit = DEFAULT_RATE_LIMIT): ProtectedForm<Contact> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  return defineProtectedForm({
    id: `${TEST_FORM_PREFIX}${suffix}`,
    schema: contactSchema,
    rateLimit,
  });
}

async function submit(
  form: ProtectedForm<Contact>,
  { fields = {}, delayMs = HUMAN_DELAY_MS, ip = VISITOR_IP }: Submission = {},
): Promise<ProtectedFormResult<Contact>> {
  const { timestamp } = issueFormProtection(form, {
    env: ENV,
    now: () => RENDERED_AT,
  });
  const body = new FormData();
  const allFields = {
    name: SUBMITTED_NAME,
    [TIMESTAMP_FIELD]: timestamp,
    [TURNSTILE_FIELD]: TURNSTILE_TEST_KEYS.dummyToken,
    ...fields,
  };
  for (const [name, value] of Object.entries(allFields)) {
    body.set(name, value);
  }
  const request = new Request("https://volleytip.test/contacto", {
    method: "POST",
    headers: { "X-Forwarded-For": ip },
    body,
  });
  return processProtectedForm(request, form, {
    env: ENV,
    now: () => RENDERED_AT + delayMs,
    store,
  });
}

async function submitTimes(
  form: ProtectedForm<Contact>,
  times: number,
): Promise<string[]> {
  const statuses: string[] = [];
  for (let sent = 0; sent < times; sent += 1) {
    statuses.push((await submit(form)).status);
  }
  return statuses;
}

async function readRejections(formId: string): Promise<RejectionRow[]> {
  return database<RejectionRow[]>`
    select reason, count from public.form_rejections
    where form = ${formId} order by reason
  `;
}

describeIntegration("formulario protegido contra la base local", () => {
  beforeAll(() => {
    database = connectToLocalDatabase();
    store = createSupabaseFormStore(createLocalServiceClient());
  });

  afterAll(async () => {
    await database`
      delete from public.rate_limits where key like ${`${TEST_FORM_PREFIX}%`}
    `;
    await database`
      delete from public.form_rejections where form like ${`${TEST_FORM_PREFIX}%`}
    `;
    await database.end();
  });

  it("acepta 5 envíos en la ventana y rechaza el sexto", async () => {
    const form = buildTestForm();

    const statuses = await submitTimes(form, DEFAULT_RATE_LIMIT.maxAttempts);
    const sixth = await submit(form);

    expect(statuses).toEqual(Array(5).fill("accepted"));
    expect(sixth).toEqual({ status: "rate_limited" });
    expect(await readRejections(form.id)).toEqual([
      { reason: "rate_limit", count: 1 },
    ]);
  });

  it("el límite de un formulario no afecta a otro", async () => {
    const limited = buildTestForm();
    const other = buildTestForm();
    await submitTimes(limited, DEFAULT_RATE_LIMIT.maxAttempts + 1);

    const result = await submit(other);

    expect(result.status).toBe("accepted");
  });

  it("el límite de una IP no afecta a otra", async () => {
    const form = buildTestForm();
    await submitTimes(form, DEFAULT_RATE_LIMIT.maxAttempts + 1);

    const result = await submit(form, { ip: "198.51.100.20" });

    expect(result.status).toBe("accepted");
  });

  it("en modo flag el envío sobre el límite pasa marcado y no cuenta como rechazo", async () => {
    const form = buildTestForm({
      maxAttempts: 1,
      windowSeconds: 3600,
      mode: "flag",
    });
    await submit(form);

    const second = await submit(form);

    expect(second).toMatchObject({ status: "accepted", overLimit: true });
    expect(await readRejections(form.id)).toEqual([]);
  });

  it("cada rechazo suma 1 a su motivo y nada más", async () => {
    const form = buildTestForm();

    await submit(form, { fields: { [HONEYPOT_FIELD]: "lleno" } });
    await submit(form, { delayMs: BOT_DELAY_MS });
    await submit(form, { fields: { [TURNSTILE_FIELD]: "token-inventado" } });
    await submit(form, { fields: { name: "" } });
    await submit(form, { fields: { name: "" } });

    expect(await readRejections(form.id)).toEqual([
      { reason: "honeypot", count: 1 },
      { reason: "too_fast", count: 1 },
      { reason: "turnstile", count: 1 },
      { reason: "validation", count: 2 },
    ]);
  });

  it("la trampa y el tiempo no gastan cupo del límite", async () => {
    const form = buildTestForm();
    await submit(form, { fields: { [HONEYPOT_FIELD]: "lleno" } });
    await submit(form, { delayMs: BOT_DELAY_MS });

    const rows = await database`
      select key from public.rate_limits where key like ${`${form.id}:%`}
    `;

    expect(rows).toHaveLength(0);
  });

  it("no guarda la IP ni el contenido del envío", async () => {
    const form = buildTestForm();
    await submit(form);
    await submit(form, { fields: { name: "" } });

    const [limits] = await database<{ dump: string }[]>`
      select coalesce(string_agg(row_to_json(l)::text, ' '), '') as dump
      from public.rate_limits l where key like ${`${form.id}:%`}
    `;
    const [rejections] = await database<{ dump: string }[]>`
      select coalesce(string_agg(row_to_json(r)::text, ' '), '') as dump
      from public.form_rejections r where form = ${form.id}
    `;
    const stored = `${limits?.dump ?? ""} ${rejections?.dump ?? ""}`;

    expect(stored).toContain(form.id);
    expect(stored).not.toContain(VISITOR_IP);
    expect(stored).not.toContain(SUBMITTED_NAME);
  });

  it("si la base rechaza la consulta del límite, lanza", async () => {
    const brokenEnv = buildTestServerEnv({
      supabaseUrl: "http://127.0.0.1:9",
    });
    const brokenStore = createSupabaseFormStore(
      createServiceSupabaseClient(brokenEnv),
    );

    await expect(
      brokenStore.checkRateLimit({
        key: `${TEST_FORM_PREFIX}caida`,
        maxAttempts: 5,
        windowSeconds: 600,
      }),
    ).rejects.toThrow(/límite de envíos/);
  });
});
