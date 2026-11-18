import { afterAll, beforeAll, expect, it } from "vitest";

import {
  connectToLocalDatabase,
  takeOnlyRow,
  type Database,
  type Transaction,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

import {
  readTableScope,
  reviewCatalog,
  type CatalogTable,
} from "./catalog-review";

// Tabla que las pruebas crean dentro de una transacción que se revierte.
const SCRATCH_TABLE = "prueba_guardia_catalogo";

/** Señal para revertir la transacción después de observar lo que interesa. */
class RollbackSignal extends Error {}

let database: Database;

/**
 * Todas las tablas del esquema `public`: normales, particionadas y foráneas.
 * Una tabla foránea no admite RLS y la API la expone igual, así que la
 * revisión la reporta y obliga a decidir qué hacer con ella. Las vistas
 * quedan fuera: las cubre el ticket que cree cada una.
 */
async function readPublicTables(
  connection: Database | Transaction,
): Promise<CatalogTable[]> {
  const rows = await connection<
    { name: string; has_rls: boolean; comment: string | null }[]
  >`
    select c.relname::text as name,
           c.relrowsecurity as has_rls,
           obj_description(c.oid, 'pg_class') as comment
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p', 'f')
    order by c.relname
  `;
  return rows.map((row) => ({
    name: row.name,
    hasRowLevelSecurity: row.has_rls,
    comment: row.comment,
  }));
}

/** Corre `work` en una transacción y la revierte siempre: la base queda igual. */
async function runAndRollBack<Result>(
  work: (transaction: Transaction) => Promise<Result>,
): Promise<Result> {
  let outcome: { readonly value: Result } | undefined;
  try {
    await database.begin(async (transaction) => {
      outcome = { value: await work(transaction) };
      throw new RollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof RollbackSignal)) {
      throw error;
    }
  }
  if (outcome === undefined) {
    throw new Error("La transacción terminó sin ejecutar el trabajo pedido");
  }
  return outcome.value;
}

async function scratchTableExists(): Promise<boolean> {
  const rows = await database<{ table_exists: boolean }[]>`
    select to_regclass(${`public.${SCRATCH_TABLE}`}) is not null as table_exists
  `;
  return takeOnlyRow(rows, "to_regclass").table_exists;
}

beforeAll(() => {
  database = connectToLocalDatabase();
});

afterAll(async () => {
  await database.end();
});

describeIntegration("catálogo real", () => {
  it("todas las tablas de public tienen RLS y declaran su ámbito", async () => {
    const tables = await readPublicTables(database);

    expect(tables.length).toBeGreaterThan(0);
    expect(reviewCatalog(tables)).toEqual([]);
  });

  it("las tablas de W1 declaran el ámbito que fija el PRD", async () => {
    const tables = await readPublicTables(database);
    const scopes = Object.fromEntries(
      tables.map((table) => [table.name, readTableScope(table.comment)]),
    );

    expect(scopes).toMatchObject({
      profiles: "shared",
      settings: "web",
      audit_log: "web",
      rate_limits: "web",
      form_rejections: "web",
    });
  });
});

describeIntegration("catálogo real: detección", () => {
  it("nombra una tabla creada sin RLS y sin comentario", async () => {
    const problems = await runAndRollBack(async (transaction) => {
      await transaction`create table public.prueba_guardia_catalogo (id integer)`;
      return reviewCatalog(await readPublicTables(transaction));
    });

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain(`public.${SCRATCH_TABLE}`);
    expect(problems[1]).toContain(`public.${SCRATCH_TABLE}`);
  });

  it("nombra una tabla con RLS y un ámbito inválido", async () => {
    const problems = await runAndRollBack(async (transaction) => {
      await transaction`create table public.prueba_guardia_catalogo (id integer)`;
      await transaction`alter table public.prueba_guardia_catalogo enable row level security`;
      await transaction`comment on table public.prueba_guardia_catalogo is 'scope: app. Prueba.'`;
      return reviewCatalog(await readPublicTables(transaction));
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`public.${SCRATCH_TABLE}`);
    expect(problems[0]).toContain("scope: shared");
  });

  it("no reporta una tabla con RLS y ámbito válido", async () => {
    const problems = await runAndRollBack(async (transaction) => {
      await transaction`create table public.prueba_guardia_catalogo (id integer)`;
      await transaction`alter table public.prueba_guardia_catalogo enable row level security`;
      await transaction`comment on table public.prueba_guardia_catalogo is 'scope: web. Prueba.'`;
      return reviewCatalog(await readPublicTables(transaction));
    });

    expect(problems).toEqual([]);
  });

  it("deja la base igual al terminar", async () => {
    await runAndRollBack(async (transaction) => {
      await transaction`create table public.prueba_guardia_catalogo (id integer)`;
    });

    expect(await scratchTableExists()).toBe(false);
  });
});

describeIntegration("RLS sin políticas", () => {
  // La tabla solo existe dentro de la transacción, así que no se puede
  // consultar por la API. Se consulta como lo hace la API para una petición
  // con la llave pública y sin sesión: con el rol `anon`.
  it("un cliente sin sesión recibe cero filas aunque la tabla tenga datos", async () => {
    const counts = await runAndRollBack(async (transaction) => {
      await transaction`create table public.prueba_guardia_catalogo (id integer)`;
      await transaction`alter table public.prueba_guardia_catalogo enable row level security`;
      await transaction`insert into public.prueba_guardia_catalogo (id) values (1), (2)`;
      await transaction`grant select on table public.prueba_guardia_catalogo to anon`;
      const stored =
        await transaction`select id from public.prueba_guardia_catalogo`;

      await transaction`select set_config('request.jwt.claims', '{"role":"anon"}', true)`;
      await transaction`select set_config('role', 'anon', true)`;
      const visible =
        await transaction`select id from public.prueba_guardia_catalogo`;

      return { stored: stored.length, visible: visible.length };
    });

    expect(counts).toEqual({ stored: 2, visible: 0 });
  });

  it("sin RLS, ese mismo cliente sí vería las filas", async () => {
    const visibleRows = await runAndRollBack(async (transaction) => {
      await transaction`create table public.prueba_guardia_catalogo (id integer)`;
      await transaction`insert into public.prueba_guardia_catalogo (id) values (1), (2)`;
      await transaction`grant select on table public.prueba_guardia_catalogo to anon`;

      await transaction`select set_config('role', 'anon', true)`;
      const visible =
        await transaction`select id from public.prueba_guardia_catalogo`;
      return visible.length;
    });

    expect(visibleRows).toBe(2);
  });
});
