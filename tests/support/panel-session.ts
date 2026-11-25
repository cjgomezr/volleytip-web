/**
 * Entrar al panel en una prueba de Playwright, sin pasar por el correo: crea
 * en la base local un usuario con el rol pedido, le abre sesión y pone sus
 * cookies en el navegador. Los usuarios se borran al terminar la prueba.
 *
 *   test("...", async ({ page, signInToPanel }) => {
 *     await signInToPanel({ role: "admin" });
 *     await page.goto("/admin");
 *   });
 */
import type { BrowserContext } from "@playwright/test";

import {
  createTestSession,
  deactivateTestUser,
  deleteTestSessionUser,
  type TestSession,
  type TestSessionOptions,
} from "../../src/testing/local-session";
import { readLocalSupabaseStatusOnce } from "./local-supabase-status-once";
import { test as base } from "./test";

export { expect } from "./test";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";

interface PanelFixtures {
  readonly signInToPanel: (options: TestSessionOptions) => Promise<TestSession>;
  readonly deactivate: (session: TestSession) => Promise<void>;
}

async function addSessionCookies(
  context: BrowserContext,
  session: TestSession,
): Promise<void> {
  await context.addCookies(
    session.cookies.map(({ name, value }) => ({
      name,
      value,
      url: APP_URL,
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
  );
}

export const test = base.extend<PanelFixtures>({
  signInToPanel: async ({ context }, use) => {
    const status = readLocalSupabaseStatusOnce();
    const userIds: string[] = [];
    await use(async (options) => {
      const session = await createTestSession(status, options);
      userIds.push(session.userId);
      await addSessionCookies(context, session);
      return session;
    });
    for (const userId of userIds) {
      await deleteTestSessionUser(status, userId);
    }
  },
  // eslint-disable-next-line no-empty-pattern
  deactivate: async ({}, use) => {
    await use((session) =>
      deactivateTestUser(readLocalSupabaseStatusOnce(), session.userId),
    );
  },
});
