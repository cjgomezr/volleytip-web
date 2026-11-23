import { afterAll, beforeAll, expect, it } from "vitest";

import { MAINTENANCE_MODE_KEY } from "~/lib/maintenance-mode.server";
import { loadSiteSettings } from "~/lib/site-settings.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createLocalServiceClient } from "~/testing/local-supabase.server";

describeIntegration("maintenance_mode", () => {
  let database: Database;
  let client: TypedSupabaseClient;
  let original: string | undefined;

  beforeAll(async () => {
    database = connectToLocalDatabase();
    client = createLocalServiceClient();
    const rows = await database<{ value: unknown }[]>`
      select value from public.settings where key = ${MAINTENANCE_MODE_KEY}
    `;
    original =
      rows[0] === undefined ? undefined : JSON.stringify(rows[0].value);
  });

  afterAll(async () => {
    await database`delete from public.settings where key = ${MAINTENANCE_MODE_KEY}`;
    if (original !== undefined) {
      await database`insert into public.settings (key, value) values (${MAINTENANCE_MODE_KEY}, ${original}::text::jsonb)`;
    }
    await database.end();
  });

  async function store(value: unknown): Promise<void> {
    await database`
      insert into public.settings (key, value)
      values (${MAINTENANCE_MODE_KEY}, ${JSON.stringify(value)}::text::jsonb)
      on conflict (key) do update set value = excluded.value
    `;
  }

  it("ve el modo encendido y, al apagar la fila, apagado, sin memoria", async () => {
    await store({ enabled: true });
    expect((await loadSiteSettings(client)).maintenance.enabled).toBe(true);

    await store({ enabled: false });
    expect((await loadSiteSettings(client)).maintenance.enabled).toBe(false);
  });
});
