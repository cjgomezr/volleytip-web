import postgres from "postgres";
import { expect, it } from "vitest";

import { describeIntegration } from "./describe-integration";
import { LOCAL_DATABASE_URL } from "./local-database";

describeIntegration("base local", () => {
  it("responde una consulta trivial", async () => {
    const sql = postgres(LOCAL_DATABASE_URL, { max: 1 });

    try {
      const rows = await sql<{ answer: number }[]>`select 1 as answer`;

      expect(rows).toEqual([{ answer: 1 }]);
    } finally {
      await sql.end();
    }
  });
});
