import { afterAll, beforeAll, expect, it } from "vitest";

import { SITE_STAT_IDS } from "~/lib/site-stats.server";
import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

describeIntegration("cifras sembradas", () => {
  let database: Database;

  beforeAll(() => {
    database = connectToLocalDatabase();
  });

  afterAll(async () => {
    await database.end();
  });

  it("deja las cuatro cifras con valor y leyenda en español y en inglés", async () => {
    const rows = await database<{ key: string; locale: string }[]>`
      select key, locale from public.site_texts where key like 'stats.%'`;
    const present = new Set(rows.map(({ key, locale }) => `${key}:${locale}`));

    const expected = SITE_STAT_IDS.flatMap((id) =>
      ["es", "en"].flatMap((locale) => [
        `stats.${id}.value:${locale}`,
        `stats.${id}.label:${locale}`,
      ]),
    );
    expect(expected.filter((entry) => !present.has(entry))).toEqual([]);
  });
});
