import { afterAll, beforeAll, expect, it } from "vitest";

import { savePanelLocale } from "~/lib/panel/save-panel-locale.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTestSession,
  deleteTestSessionUser,
  toCookieHeader,
} from "~/testing/local-session";
import { createLocalServiceClient } from "~/testing/local-supabase.server";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";
import { buildTestServerEnv } from "~/testing/test-server-env";

const createdUserIds: string[] = [];
let status: LocalSupabaseStatus;

describeIntegration("idioma del panel contra la base local", () => {
  beforeAll(() => {
    status = readLocalSupabaseStatus();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await deleteTestSessionUser(status, userId);
    }
  });

  it("un admin guarda su idioma en profiles.locale y queda en la bitácora", async () => {
    const { userId, cookies } = await createTestSession(status, {
      role: "admin",
    });
    createdUserIds.push(userId);
    const { client } = createSessionSupabaseClient(
      new Request("http://localhost/admin", {
        headers: { Cookie: toCookieHeader(cookies) },
      }),
      buildTestServerEnv({
        supabaseUrl: status.API_URL,
        supabaseAnonKey: status.PUBLISHABLE_KEY,
      }),
    );
    const service = createLocalServiceClient();

    await savePanelLocale({
      client,
      memberId: userId,
      locale: "en",
      auditClient: service,
    });

    const profile = await service
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .single();
    expect(profile.data?.locale).toBe("en");
    const entries = await service
      .from("audit_log")
      .select("action, details")
      .eq("actor_id", userId);
    expect(entries.data).toEqual([
      {
        action: "profile.set_locale",
        details: { before: { locale: "es" }, after: { locale: "en" } },
      },
    ]);
  });
});
