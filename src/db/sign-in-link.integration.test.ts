import { randomInt } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { ServerEnv } from "~/lib/env.server";
import {
  ADMIN_SIGN_IN_FORM,
  handleSignInRequest,
} from "~/lib/forms/admin-sign-in-form.server";
import { TIMESTAMP_FIELD } from "~/lib/forms/field-names";
import { createSupabaseFormStore } from "~/lib/forms/form-store.server";
import { issueFormProtection } from "~/lib/forms/protected-form.server";
import { TURNSTILE_TEST_KEYS } from "~/lib/forms/turnstile-test-keys";
import { TURNSTILE_FIELD } from "~/lib/forms/turnstile.server";
import { redeemSignInLink } from "~/lib/panel/redeem-sign-in-link.server";
import { identifyVisitor } from "~/lib/panel/visitor.server";
import { createServiceSupabaseClient } from "~/lib/supabase/service-client.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import { buildTestEmail } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { findLink, listEmailIds, waitForEmail } from "~/testing/local-mailbox";
import {
  createTestSession,
  deleteTestSessionUser,
} from "~/testing/local-session";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";
import { buildTestServerEnv } from "~/testing/test-server-env";

// El `site_url` de `supabase/config.toml`.
const SITE_ORIGIN = "http://localhost:3740";
const HUMAN_DELAY_MS = 4000;
// El correo local es síncrono: si fuera a llegar, a esta altura ya llegó.
const DELIVERY_MARGIN_MS = 1000;

let status: LocalSupabaseStatus;
let env: ServerEnv;
const createdUserIds: string[] = [];

async function createUser(role: "admin" | "buyer"): Promise<string> {
  const { userId, email } = await createTestSession(status, { role });
  createdUserIds.push(userId);
  return email;
}

async function requestLink(email: string, next?: string): Promise<unknown> {
  const { timestamp } = issueFormProtection(ADMIN_SIGN_IN_FORM, {
    env,
    now: () => Date.now() - HUMAN_DELAY_MS,
  });
  const body = new URLSearchParams({
    email,
    [TIMESTAMP_FIELD]: timestamp,
    [TURNSTILE_FIELD]: TURNSTILE_TEST_KEYS.dummyToken,
  });
  const query =
    next === undefined ? "" : `?${new URLSearchParams({ next }).toString()}`;
  // Cada petición con su IP, para no chocar con el límite de corridas
  // anteriores.
  const ip = `10.${randomInt(250)}.${randomInt(250)}.${randomInt(250)}`;
  const request = new Request(`${SITE_ORIGIN}/admin/entrar${query}`, {
    method: "POST",
    headers: { "X-Forwarded-For": ip },
    body,
  });
  const response = await handleSignInRequest(request, {
    env,
    protection: {
      env,
      store: createSupabaseFormStore(createServiceSupabaseClient(env)),
    },
  });
  return response.data;
}

/** Un navegador que nunca habló con el sitio: sin ninguna cookie. */
function openFreshBrowser(): ReturnType<typeof createSessionSupabaseClient> {
  return createSessionSupabaseClient(new Request(SITE_ORIGIN), env);
}

describeIntegration("entrada con enlace contra la base local", () => {
  beforeAll(() => {
    status = readLocalSupabaseStatus();
    env = buildTestServerEnv({
      supabaseUrl: status.API_URL,
      supabaseAnonKey: status.PUBLISHABLE_KEY,
      supabaseServiceRoleKey: status.SECRET_KEY,
      siteOrigin: SITE_ORIGIN,
    });
  });

  afterAll(async () => {
    for (const userId of createdUserIds.splice(0)) {
      await deleteTestSessionUser(status, userId);
    }
  });

  it("deja un correo cuyo enlace, canjeado una vez, da sesión de admin", async () => {
    const email = await createUser("admin");

    await expect(requestLink(email, "/admin/mensajes?page=2")).resolves.toEqual(
      { status: "sent" },
    );
    const message = await waitForEmail(email);
    const link = findLink(message, "/admin/entrar/enlace");
    const englishLink = findLink(message, "/en/admin/sign-in/link");

    expect(message.subject).toMatch(/entrar.*sign-in/i);
    expect(link.origin).toBe(SITE_ORIGIN);
    expect(link.searchParams.get("next")).toBe(
      `${SITE_ORIGIN}/admin/mensajes?page=2`,
    );
    const tokenHash = link.searchParams.get("token_hash") ?? "";
    expect(englishLink.searchParams.get("token_hash")).toBe(tokenHash);

    const browser = openFreshBrowser();
    await expect(
      redeemSignInLink(browser.client, tokenHash),
    ).resolves.toMatchObject({
      status: "signed_in",
      member: { email, role: "admin" },
    });
    await expect(identifyVisitor(browser.client)).resolves.toMatchObject({
      kind: "member",
    });
    await expect(
      redeemSignInLink(openFreshBrowser().client, tokenHash),
    ).resolves.toEqual({ status: "invalid_link" });
  });

  it("un token alterado no da sesión", async () => {
    await expect(
      redeemSignInLink(openFreshBrowser().client, "0".repeat(56)),
    ).resolves.toEqual({ status: "invalid_link" });
  });

  it.each(["ajeno", "de un buyer"])(
    "para un correo %s el buzón queda vacío",
    async (kind) => {
      const email =
        kind === "ajeno" ? buildTestEmail() : await createUser("buyer");

      await expect(requestLink(email)).resolves.toEqual({ status: "sent" });
      await new Promise((resolve) => setTimeout(resolve, DELIVERY_MARGIN_MS));

      await expect(listEmailIds(email)).resolves.toEqual([]);
    },
  );
});
