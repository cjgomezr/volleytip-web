import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { hasTransactionControl } from "./migration-review";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
}

describe("hasTransactionControl", () => {
  it.each([
    "begin;",
    "BEGIN;",
    "  commit ;",
    "rollback;",
    "start transaction;",
    "begin transaction;",
    "commit work;",
  ])("detecta `%s`", (statement) => {
    expect(hasTransactionControl(`select 1;\n${statement}\nselect 2;`)).toBe(
      true,
    );
  });

  it("no confunde el bloque de una función plpgsql", () => {
    const sql =
      "create function f() returns int language plpgsql as $$\nbegin\n  return 1;\nend;\n$$;";

    expect(hasTransactionControl(sql)).toBe(false);
  });

  it("no mira dentro de un comentario de línea", () => {
    expect(hasTransactionControl("-- commit;\nselect 1;")).toBe(false);
  });

  it("no reporta SQL sin control de transacción", () => {
    expect(hasTransactionControl("create table t (id integer);")).toBe(false);
  });
});

describe("archivos de migración", () => {
  it("hay al menos una migración", () => {
    expect(listMigrationFiles().length).toBeGreaterThan(0);
  });

  it.each(listMigrationFiles())(
    "%s no abre ni cierra transacciones por su cuenta",
    (fileName) => {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf8");

      expect(hasTransactionControl(sql)).toBe(false);
    },
  );
});
