import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  takeOnlyRow,
  type Database,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createLocalServiceClient } from "~/testing/local-supabase.server";

import { recordAuditEntry } from "./audit-log.server";
import type { ServerEnv } from "./env.server";
import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

interface StoredEntry {
  readonly actor_id: string | null;
  readonly entity: string;
  readonly entity_id: string | null;
  readonly details: unknown;
  readonly is_recent: boolean;
}

// El puerto 1 no lo escucha nadie: la conexión se rechaza siempre.
const UNREACHABLE_ENV: ServerEnv = {
  appEnv: "test",
  supabaseUrl: "http://127.0.0.1:1",
  supabaseAnonKey: "llave-publica-falsa",
  supabaseServiceRoleKey: "llave-de-servicio-falsa",
};

describe("registro de auditoría: fallo de la base", () => {
  it("lanza con la acción en el mensaje, no falla en silencio", async () => {
    const unreachableClient = createServiceSupabaseClient(UNREACHABLE_ENV);

    await expect(
      recordAuditEntry(
        { actorId: null, action: "order.refund", entity: "order" },
        unreachableClient,
      ),
    ).rejects.toThrow(/No se pudo registrar "order.refund"/);
  });
});

describeIntegration("registro de auditoría", () => {
  let database: Database;
  let client: TypedSupabaseClient;
  let actionCounter = 0;

  // La bitácora no se puede limpiar, así que cada prueba usa una acción
  // propia para encontrar su entrada.
  function buildTestAction(): string {
    actionCounter += 1;
    return `prueba.registro.${Date.now()}.${actionCounter}`;
  }

  async function readEntry(action: string): Promise<StoredEntry> {
    const rows = await database<StoredEntry[]>`
      select actor_id, entity, entity_id, details,
             created_at > now() - interval '1 minute' as is_recent
      from public.audit_log where action = ${action}
    `;
    return takeOnlyRow(rows, `audit_log (${action})`);
  }

  beforeAll(() => {
    database = connectToLocalDatabase();
    client = createLocalServiceClient();
  });

  afterAll(async () => {
    await deleteTestUsers(database);
    await database.end();
  });

  it("guarda actor, acción, entidad, id y detalles, con la fecha de la base", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    const action = buildTestAction();

    await recordAuditEntry(
      {
        actorId: admin.id,
        action,
        entity: "profile",
        entityId: admin.id,
        details: { motivo: "prueba", monto: 1000 },
      },
      client,
    );

    expect(await readEntry(action)).toEqual({
      actor_id: admin.id,
      entity: "profile",
      entity_id: admin.id,
      details: { motivo: "prueba", monto: 1000 },
      is_recent: true,
    });
  });

  it.each([
    ["ausentes", undefined],
    ["nulos", null],
    ["vacíos", {}],
  ])("acepta detalles %s y guarda un objeto vacío", async (_case, details) => {
    const action = buildTestAction();

    await recordAuditEntry(
      { actorId: null, action, entity: "setting", details },
      client,
    );

    expect(await readEntry(action)).toMatchObject({
      actor_id: null,
      entity_id: null,
      details: {},
    });
  });

  it("lanza cuando la base rechaza la entrada", async () => {
    await expect(
      recordAuditEntry({ actorId: null, action: "", entity: "order" }, client),
    ).rejects.toThrow(/No se pudo registrar/);
  });

  it("lanza cuando el actor no existe", async () => {
    const missingActorId = "00000000-0000-4000-8000-000000000000";

    await expect(
      recordAuditEntry(
        { actorId: missingActorId, action: buildTestAction(), entity: "order" },
        client,
      ),
    ).rejects.toThrow(/No se pudo registrar/);
  });
});
