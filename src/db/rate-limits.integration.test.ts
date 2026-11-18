import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, it } from "vitest";

import { createAnonSupabaseClient } from "~/lib/supabase/anon-client.server";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  takeOnlyRow,
  type Database,
  type Session,
  type TestUser,
  type Transaction,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createLocalServiceClient } from "~/testing/local-supabase.server";

interface RateLimitRow {
  readonly count: number;
  readonly started_recently: boolean;
  readonly window_seconds: number;
}

interface RejectionRow {
  readonly reason: string;
  readonly count: number;
  readonly is_today_utc: boolean;
}

interface RateLimitCall {
  readonly key: string;
  readonly maxAttempts?: number;
  readonly windowSeconds?: number;
}

const ANONYMOUS: Session = { kind: "anonymous" };
const SERVICE: Session = { kind: "service" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 600;
const SIMULTANEOUS_CALLS = 10;
// Las filas de prueba llevan estos prefijos para borrarlas sin tocar otras.
const TEST_KEY_PREFIX = "prueba.limite.";
const TEST_FORM_PREFIX = "prueba_";
const CLEANUP_JOB_NAME = "purge-expired-rate-limits";
const DAILY_SCHEDULE = /^\d{1,2} \d{1,2} \* \* \*$/;

let database: Database;
let service: SupabaseClient;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

function buildTestKey(): string {
  return `${TEST_KEY_PREFIX}${randomUUID()}`;
}

function buildTestForm(): string {
  return `${TEST_FORM_PREFIX}${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/** Llama a `check_rate_limit` como lo hará el servidor: por la API, con la
 * llave de servicio. Devuelve si el envío queda permitido. */
async function checkRateLimit(call: RateLimitCall): Promise<boolean> {
  const { data, error } = await service.rpc("check_rate_limit", {
    p_key: call.key,
    p_max_attempts: call.maxAttempts ?? MAX_ATTEMPTS,
    p_window_seconds: call.windowSeconds ?? WINDOW_SECONDS,
  });
  if (error !== null) {
    throw new Error(error.message);
  }
  if (typeof data !== "boolean") {
    throw new Error("check_rate_limit no devolvió un booleano");
  }
  return data;
}

async function checkRateLimitTimes(
  key: string,
  times: number,
): Promise<boolean[]> {
  const results: boolean[] = [];
  for (let attempt = 0; attempt < times; attempt += 1) {
    results.push(await checkRateLimit({ key }));
  }
  return results;
}

async function recordFormRejection(
  form: string,
  reason: string,
): Promise<void> {
  const { error } = await service.rpc("record_form_rejection", {
    p_form: form,
    p_reason: reason,
  });
  if (error !== null) {
    throw new Error(error.message);
  }
}

async function readRateLimitRows(key: string): Promise<RateLimitRow[]> {
  return database<RateLimitRow[]>`
    select count,
           window_start > now() - interval '1 minute' as started_recently,
           extract(epoch from expires_at - window_start)::integer as window_seconds
    from public.rate_limits where key = ${key}
  `;
}

async function readRejectionRows(form: string): Promise<RejectionRow[]> {
  return database<RejectionRow[]>`
    select reason, count,
           day = (now() at time zone 'utc')::date as is_today_utc
    from public.form_rejections where form = ${form}
    order by reason
  `;
}

/** Siembra un límite cuya ventana vence (o venció) según `expiresIn`, un
 * intervalo de Postgres relativo a ahora: '-2 days', '5 minutes'. */
async function seedRateLimit(expiresIn: string): Promise<string> {
  const key = buildTestKey();
  await database`
    insert into public.rate_limits (key, window_start, expires_at, count)
    values (${key},
            now() + ${expiresIn}::interval - interval '10 minutes',
            now() + ${expiresIn}::interval,
            1)
  `;
  return key;
}

async function seedRejection(): Promise<string> {
  const form = buildTestForm();
  await database`
    insert into public.form_rejections (form, reason, day, count)
    values (${form}, 'honeypot', (now() at time zone 'utc')::date, 1)
  `;
  return form;
}

async function expireWindow(key: string): Promise<void> {
  await database`
    update public.rate_limits
    set window_start = now() - interval '11 minutes',
        expires_at = now() - interval '1 minute'
    where key = ${key}
  `;
}

function countVisibleRows(
  session: Session,
  rows: { readonly key: string; readonly form: string },
): Promise<{ rateLimits: number; rejections: number }> {
  return runAs(database, session, async (transaction) => {
    const limits = await transaction`
      select key from public.rate_limits where key = ${rows.key}
    `;
    const rejections = await transaction`
      select form from public.form_rejections where form = ${rows.form}
    `;
    return { rateLimits: limits.length, rejections: rejections.length };
  });
}

type Statement = (transaction: Transaction) => Promise<unknown>;

const FUNCTION_CALLS: readonly (readonly [string, Statement])[] = [
  [
    "check_rate_limit",
    (transaction) =>
      transaction`select public.check_rate_limit(${buildTestKey()}, 5, 600)`,
  ],
  [
    "record_form_rejection",
    (transaction) =>
      transaction`select public.record_form_rejection(${buildTestForm()}, 'honeypot')`,
  ],
  [
    "purge_expired_rate_limits",
    (transaction) => transaction`select public.purge_expired_rate_limits()`,
  ],
];

const TABLE_WRITES: readonly (readonly [string, Statement])[] = [
  [
    "insertar en rate_limits",
    (transaction) => transaction`
      insert into public.rate_limits (key, window_start, expires_at, count)
      values (${buildTestKey()}, now(), now() + interval '10 minutes', 1)
    `,
  ],
  [
    "actualizar rate_limits",
    (transaction) => transaction`update public.rate_limits set count = 1`,
  ],
  [
    "borrar de rate_limits",
    (transaction) => transaction`delete from public.rate_limits`,
  ],
  [
    "insertar en form_rejections",
    (transaction) => transaction`
      insert into public.form_rejections (form, reason, day, count)
      values (${buildTestForm()}, 'honeypot', current_date, 1)
    `,
  ],
  [
    "actualizar form_rejections",
    (transaction) => transaction`update public.form_rejections set count = 1`,
  ],
  [
    "borrar de form_rejections",
    (transaction) => transaction`delete from public.form_rejections`,
  ],
];

beforeAll(() => {
  database = connectToLocalDatabase();
  service = createLocalServiceClient();
});

afterAll(async () => {
  await database`
    delete from public.rate_limits
    where left(key, ${TEST_KEY_PREFIX.length}) = ${TEST_KEY_PREFIX}
  `;
  await database`
    delete from public.form_rejections
    where left(form, ${TEST_FORM_PREFIX.length}) = ${TEST_FORM_PREFIX}
  `;
  await deleteTestUsers(database);
  await database.end();
});

describeIntegration("check_rate_limit", () => {
  it("permite las 5 primeras llamadas de una clave sin uso", async () => {
    const key = buildTestKey();

    const results = await checkRateLimitTimes(key, MAX_ATTEMPTS);

    expect(results).toEqual([true, true, true, true, true]);
  });

  it("rechaza la sexta llamada dentro de la ventana", async () => {
    const key = buildTestKey();
    await checkRateLimitTimes(key, MAX_ATTEMPTS);

    expect(await checkRateLimit({ key })).toBe(false);
  });

  it("sigue rechazando después de la sexta", async () => {
    const key = buildTestKey();
    await checkRateLimitTimes(key, MAX_ATTEMPTS + 1);

    expect(await checkRateLimit({ key })).toBe(false);
  });

  it("guarda una fila por clave con el conteo y la ventana pedida", async () => {
    const key = buildTestKey();

    await checkRateLimitTimes(key, 3);

    expect(await readRateLimitRows(key)).toEqual([
      { count: 3, started_recently: true, window_seconds: WINDOW_SECONDS },
    ]);
  });

  it("una clave en el límite no afecta a otra", async () => {
    const exhaustedKey = buildTestKey();
    const otherKey = buildTestKey();
    await checkRateLimitTimes(exhaustedKey, MAX_ATTEMPTS + 1);

    expect(await checkRateLimit({ key: otherKey })).toBe(true);
  });

  it("con la ventana vencida permite de nuevo y empieza una ventana nueva", async () => {
    const key = buildTestKey();
    await checkRateLimitTimes(key, MAX_ATTEMPTS + 1);
    await expireWindow(key);

    const isAllowed = await checkRateLimit({ key });

    expect(isAllowed).toBe(true);
    expect(await readRateLimitRows(key)).toEqual([
      { count: 1, started_recently: true, window_seconds: WINDOW_SECONDS },
    ]);
  });

  it("respeta el máximo que recibe en cada llamada", async () => {
    const key = buildTestKey();

    const first = await checkRateLimit({ key, maxAttempts: 1 });
    const second = await checkRateLimit({ key, maxAttempts: 1 });

    expect([first, second]).toEqual([true, false]);
  });
});

describeIntegration("check_rate_limit: concurrencia", () => {
  it("con 10 llamadas simultáneas a la misma clave permite exactamente 5", async () => {
    const key = buildTestKey();

    const results = await Promise.all(
      Array.from({ length: SIMULTANEOUS_CALLS }, () => checkRateLimit({ key })),
    );

    expect(results.filter((isAllowed) => isAllowed)).toHaveLength(MAX_ATTEMPTS);
    expect(await readRateLimitRows(key)).toMatchObject([
      { count: SIMULTANEOUS_CALLS },
    ]);
  });
});

describeIntegration("check_rate_limit: entradas borde", () => {
  it.each([
    ["máximo 0", { maxAttempts: 0 }, /p_max_attempts/],
    ["máximo negativo", { maxAttempts: -1 }, /p_max_attempts/],
    ["ventana 0", { windowSeconds: 0 }, /p_window_seconds/],
    ["ventana negativa", { windowSeconds: -60 }, /p_window_seconds/],
  ] as const)(
    "falla con %s y no cuenta nada",
    async (_case, limits, message) => {
      const key = buildTestKey();

      await expect(checkRateLimit({ key, ...limits })).rejects.toThrow(message);

      expect(await readRateLimitRows(key)).toEqual([]);
    },
  );

  it.each([
    ["vacía", ""],
    ["solo espacios", "   "],
  ] as const)("falla con una clave %s", async (_case, key) => {
    await expect(checkRateLimit({ key })).rejects.toThrow(/p_key/);

    expect(await readRateLimitRows(key)).toEqual([]);
  });

  it("falla con una clave de más de 200 caracteres", async () => {
    const key = TEST_KEY_PREFIX + "a".repeat(200);

    await expect(checkRateLimit({ key })).rejects.toThrow(
      /rate_limits_key_check/,
    );

    expect(await readRateLimitRows(key)).toEqual([]);
  });

  it("falla con un máximo nulo", async () => {
    await expect(
      database`select public.check_rate_limit(${buildTestKey()}, null, 600)`,
    ).rejects.toThrow(/p_max_attempts/);
  });

  it("falla con una ventana nula", async () => {
    await expect(
      database`select public.check_rate_limit(${buildTestKey()}, 5, null)`,
    ).rejects.toThrow(/p_window_seconds/);
  });

  it("falla con una clave nula", async () => {
    await expect(
      database`select public.check_rate_limit(null, 5, 600)`,
    ).rejects.toThrow(/p_key/);
  });
});

describeIntegration("record_form_rejection", () => {
  it("dos rechazos iguales el mismo día suman en una sola fila", async () => {
    const form = buildTestForm();

    await recordFormRejection(form, "honeypot");
    await recordFormRejection(form, "honeypot");

    expect(await readRejectionRows(form)).toEqual([
      { reason: "honeypot", count: 2, is_today_utc: true },
    ]);
  });

  it("motivos distintos van en filas distintas", async () => {
    const form = buildTestForm();

    await recordFormRejection(form, "honeypot");
    await recordFormRejection(form, "turnstile");

    expect(await readRejectionRows(form)).toEqual([
      { reason: "honeypot", count: 1, is_today_utc: true },
      { reason: "turnstile", count: 1, is_today_utc: true },
    ]);
  });

  it("formularios distintos van en filas distintas", async () => {
    const firstForm = buildTestForm();
    const secondForm = buildTestForm();

    await recordFormRejection(firstForm, "too_fast");
    await recordFormRejection(secondForm, "too_fast");

    expect(await readRejectionRows(firstForm)).toHaveLength(1);
    expect(await readRejectionRows(secondForm)).toHaveLength(1);
  });

  it("un rechazo de otro día no se suma al de hoy", async () => {
    const form = buildTestForm();
    await database`
      insert into public.form_rejections (form, reason, day, count)
      values (${form}, 'honeypot', (now() at time zone 'utc')::date - 1, 7)
    `;

    await recordFormRejection(form, "honeypot");

    const counts = (await readRejectionRows(form)).map(({ count }) => count);
    expect(counts.sort()).toEqual([1, 7]);
  });

  it.each(["turnstile", "honeypot", "too_fast", "rate_limit", "validation"])(
    "acepta el motivo %s",
    async (reason) => {
      const form = buildTestForm();

      await recordFormRejection(form, reason);

      expect(await readRejectionRows(form)).toMatchObject([{ reason }]);
    },
  );

  it.each(["spam", "", "HONEYPOT"])(
    "rechaza el motivo %j y no guarda nada",
    async (reason) => {
      const form = buildTestForm();

      await expect(recordFormRejection(form, reason)).rejects.toThrow(
        /form_rejections_reason_check/,
      );

      expect(await readRejectionRows(form)).toEqual([]);
    },
  );
});

describeIntegration("form_rejections no guarda datos del envío", () => {
  it("sus únicas columnas son form, reason, day y count", async () => {
    const columns = await database<{ name: string; type: string }[]>`
      select column_name::text as name, data_type::text as type
      from information_schema.columns
      where table_schema = 'public' and table_name = 'form_rejections'
      order by ordinal_position
    `;

    expect(columns.map(({ name, type }) => ({ name, type }))).toEqual([
      { name: "form", type: "text" },
      { name: "reason", type: "text" },
      { name: "day", type: "date" },
      { name: "count", type: "integer" },
    ]);
  });

  it.each([
    ["un correo", "ana@correo.com"],
    ["una IP", "190.25.10.7"],
    ["una frase", "hola quiero comprar"],
    ["un texto largo", `f${"a".repeat(40)}`],
    ["un texto vacío", ""],
  ] as const)("form no admite %s", async (_case, form) => {
    await expect(recordFormRejection(form, "honeypot")).rejects.toThrow(
      /form_rejections_form_check/,
    );
  });
});

describeIntegration("limpieza de rate_limits", () => {
  it("borra las vencidas hace más de un día y deja las demás", async () => {
    const longExpiredKey = await seedRateLimit("-25 hours");
    const recentlyExpiredKey = await seedRateLimit("-23 hours");
    const activeKey = await seedRateLimit("5 minutes");

    await runAs(database, SERVICE, async (transaction) => {
      await transaction`select public.purge_expired_rate_limits()`;
    });

    expect(await readRateLimitRows(longExpiredKey)).toHaveLength(0);
    expect(await readRateLimitRows(recentlyExpiredKey)).toHaveLength(1);
    expect(await readRateLimitRows(activeKey)).toHaveLength(1);
  });

  it("existe una tarea diaria y activa que llama a la limpieza", async () => {
    const jobs = await database<
      { schedule: string; command: string; active: boolean }[]
    >`
      select schedule, command, active from cron.job
      where jobname = ${CLEANUP_JOB_NAME}
    `;

    const job = takeOnlyRow(jobs, "cron.job");
    expect(job.schedule).toMatch(DAILY_SCHEDULE);
    expect(job.command).toContain("public.purge_expired_rate_limits()");
    expect(job.active).toBe(true);
  });
});

describeIntegration("RLS de rate_limits y form_rejections", () => {
  it("sin sesión no ve ninguna fila", async () => {
    const rows = {
      key: await seedRateLimit("5 minutes"),
      form: await seedRejection(),
    };

    expect(await countVisibleRows(ANONYMOUS, rows)).toEqual({
      rateLimits: 0,
      rejections: 0,
    });
  });

  it.each([
    ["buyer", true],
    ["staff", true],
    ["admin", false],
  ] as const)(
    "%s con is_active = %s no ve ninguna fila",
    async (role, isActive) => {
      const user = await createTestUser(database, { role, isActive });
      const rows = {
        key: await seedRateLimit("5 minutes"),
        form: await seedRejection(),
      };

      expect(await countVisibleRows(signedInAs(user), rows)).toEqual({
        rateLimits: 0,
        rejections: 0,
      });
    },
  );

  it("un admin activo lee las dos tablas", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const rows = {
      key: await seedRateLimit("5 minutes"),
      form: await seedRejection(),
    };

    expect(await countVisibleRows(signedInAs(admin), rows)).toEqual({
      rateLimits: 1,
      rejections: 1,
    });
  });

  it.each(TABLE_WRITES)("un admin activo no puede %s", async (_name, write) => {
    const admin = await createTestUser(database, { role: "admin" });

    await expect(runAs(database, signedInAs(admin), write)).rejects.toThrow(
      PERMISSION_DENIED,
    );
  });

  it.each(TABLE_WRITES)("sin sesión no se puede %s", async (_name, write) => {
    await expect(runAs(database, ANONYMOUS, write)).rejects.toThrow(
      PERMISSION_DENIED,
    );
  });

  it.each(FUNCTION_CALLS)(
    "sin sesión no se puede llamar %s",
    async (_name, call) => {
      await expect(runAs(database, ANONYMOUS, call)).rejects.toThrow(
        PERMISSION_DENIED,
      );
    },
  );

  it.each(["buyer", "staff", "admin"] as const)(
    "%s no puede llamar ninguna de las funciones",
    async (role) => {
      const user = await createTestUser(database, { role });

      for (const [, call] of FUNCTION_CALLS) {
        await expect(runAs(database, signedInAs(user), call)).rejects.toThrow(
          PERMISSION_DENIED,
        );
      }
    },
  );

  it("la llave pública no puede llamar las funciones por la API", async () => {
    const anon = createAnonSupabaseClient();
    const key = buildTestKey();
    const form = buildTestForm();

    const limit = await anon.rpc("check_rate_limit", {
      p_key: key,
      p_max_attempts: MAX_ATTEMPTS,
      p_window_seconds: WINDOW_SECONDS,
    });
    const rejection = await anon.rpc("record_form_rejection", {
      p_form: form,
      p_reason: "honeypot",
    });
    const purge = await anon.rpc("purge_expired_rate_limits");

    expect(limit.error?.message).toMatch(PERMISSION_DENIED);
    expect(rejection.error?.message).toMatch(PERMISSION_DENIED);
    expect(purge.error?.message).toMatch(PERMISSION_DENIED);
    expect(await readRateLimitRows(key)).toEqual([]);
    expect(await readRejectionRows(form)).toEqual([]);
  });

  it("la llave pública recibe cero filas de las dos tablas por la API", async () => {
    await seedRateLimit("5 minutes");
    await seedRejection();
    const anon = createAnonSupabaseClient();

    const limits = await anon.from("rate_limits").select("key");
    const rejections = await anon.from("form_rejections").select("form");

    expect(limits).toMatchObject({ error: null, data: [] });
    expect(rejections).toMatchObject({ error: null, data: [] });
  });
});

describeIntegration("tablas rate_limits y form_rejections", () => {
  it.each(["rate_limits", "form_rejections"])(
    "%s tiene RLS activado y su comentario declara scope: web",
    async (table) => {
      const rows = await database<
        { has_rls: boolean; comment: string | null }[]
      >`
        select relrowsecurity as has_rls,
               obj_description(oid) as comment
        from pg_class
        where relnamespace = 'public'::regnamespace and relname = ${table}
      `;

      const { has_rls: hasRls, comment } = takeOnlyRow(rows, table);
      expect(hasRls).toBe(true);
      expect(comment).toMatch(/^scope: web\b/);
    },
  );
});
