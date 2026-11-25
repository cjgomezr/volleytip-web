import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, it } from "vitest";

import { runAdminCreate } from "../../scripts/admin-create.ts";
import type { Database as DatabaseSchema } from "~/lib/database.types";
import { identifyVisitor } from "~/lib/panel/visitor.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";

describeIntegration("primer admin contra la base local", () => {
  // Dominio reservado: no es de nadie.
  const email = `primer-admin-${randomUUID()}@example.com`;
  let database: Database;
  let status: LocalSupabaseStatus;

  async function runCommand(): Promise<{ status: number; output: string }> {
    const lines: string[] = [];
    const exitCode = await runAdminCreate({
      args: [email.toUpperCase()],
      env: {
        SUPABASE_URL: status.API_URL,
        SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY,
      },
      ask: async () => new URL(status.API_URL).host,
      print: (line) => lines.push(line),
    });
    return { status: exitCode, output: lines.join("\n") };
  }

  /** Entra como lo haría la persona: con un enlace de un solo uso. El token se
   * saca con la llave de servicio, así no hace falta leer ningún correo. */
  async function signInWithLink(): Promise<TypedSupabaseClient> {
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    const service = createClient<DatabaseSchema>(
      status.API_URL,
      status.SECRET_KEY,
      options,
    );
    const link = await service.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    expect(link.error).toBeNull();
    const client = createClient<DatabaseSchema>(
      status.API_URL,
      status.PUBLISHABLE_KEY,
      options,
    );
    const { error } = await client.auth.verifyOtp({
      type: "email",
      token_hash: link.data.properties?.hashed_token ?? "",
    });
    expect(error).toBeNull();
    return client;
  }

  /** Pide el enlace como lo hará la pantalla de entrada: sin crear cuentas.
   * Devuelve el código del rechazo, o `null` si Supabase lo envía. */
  async function requestSignInLink(): Promise<string | null> {
    const client = createClient<DatabaseSchema>(
      status.API_URL,
      status.PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    return error === null ? null : (error.code ?? error.message);
  }

  async function readAuditActions(): Promise<
    { action: string; actor_id: string | null }[]
  > {
    return database<{ action: string; actor_id: string | null }[]>`
      select action, actor_id from public.audit_log
      where entity = 'profile' and entity_id in (
        select id from public.profiles where email = ${email}
      )
    `;
  }

  beforeAll(() => {
    status = readLocalSupabaseStatus();
    database = connectToLocalDatabase();
  });

  // Borrar la cuenta se lleva su perfil. Las entradas de la bitácora, que no
  // tienen actor, se quedan.
  afterAll(async () => {
    await database`delete from auth.users where email = ${email}`;
    await database.end();
  });

  it("deja un usuario que la guardia del panel reconoce como admin", async () => {
    const run = await runCommand();

    expect(run.status, run.output).toBe(0);
    const visitor = await identifyVisitor(await signInWithLink());
    expect(visitor).toMatchObject({
      kind: "member",
      member: { email, role: "admin" },
    });
  });

  it("al repetirlo no duplica la cuenta ni la entrada de la bitácora", async () => {
    await runCommand();

    const run = await runCommand();

    expect(run.status, run.output).toBe(0);
    expect(run.output).toContain("ya es admin activo");
    expect(await readAuditActions()).toEqual([
      { action: "profile.grant_admin", actor_id: null },
    ]);
  });

  it("a una cuenta sin confirmar la deja pedir el enlace", async () => {
    await runCommand();
    await database`
      update auth.users set email_confirmed_at = null where email = ${email}
    `;
    expect(await requestSignInLink()).not.toBeNull();

    const run = await runCommand();

    expect(run.status, run.output).toBe(0);
    expect(await requestSignInLink()).toBeNull();
  });

  it("reactiva como admin a quien estaba desactivado", async () => {
    await runCommand();
    await database`
      update public.profiles set role = 'staff', is_active = false
      where email = ${email}
    `;

    const run = await runCommand();

    expect(run.status, run.output).toBe(0);
    const profiles = await database`
      select role, is_active from public.profiles where email = ${email}
    `;
    expect([...profiles]).toEqual([{ role: "admin", is_active: true }]);
  });
});
