import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  panelMemberContext,
  panelSessionContext,
} from "~/lib/panel/panel-middleware.server";
import type { PanelMember } from "~/lib/panel/visitor.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  FAKE_USER_ID,
  stubSupabase,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import { action, loader } from "./language";

const MEMBER: PanelMember = {
  id: FAKE_USER_ID,
  email: ADMIN_PROFILE.email,
  fullName: ADMIN_PROFILE.full_name,
  role: "admin",
};

function buildArgs(
  path: string,
  fields: Record<string, string>,
): Parameters<typeof action>[0] {
  const request = new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    body: new URLSearchParams(fields),
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  context.set(panelMemberContext, MEMBER);
  return { request, context, params: {} } as unknown as Parameters<
    typeof action
  >[0];
}

const TO_ENGLISH = { language: "en", from: "/admin" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("idioma del panel", () => {
  it.each([
    ["/admin/idioma", "en", "/admin/mas", "/en/admin/more"],
    ["/en/admin/language", "es", "/en/admin", "/admin"],
  ])(
    "desde %s, elegir %s en %s lleva a %s",
    async (path, language, from, destination) => {
      stubSupabase({ profileLocale: language === "en" ? "es" : "en" });

      const response = (await action(
        buildArgs(path, { language, from }),
      )) as Response;

      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe(destination);
    },
  );

  it("guarda profiles.locale con la sesión de la persona", async () => {
    const supabase = stubSupabase();

    await action(buildArgs("/admin/idioma", TO_ENGLISH));

    const update = supabase.writes.find(({ method }) => method === "PATCH");
    expect(update?.path).toContain(`id=eq.${FAKE_USER_ID}`);
    expect(update?.body).toEqual({ locale: "en" });
    expect(update?.authorization).toContain("acceso-vigente");
  });

  it("deja el cambio en la bitácora con el antes y el después", async () => {
    const supabase = stubSupabase();

    await action(buildArgs("/admin/idioma", TO_ENGLISH));

    const entry = supabase.writes.find(({ path }) =>
      path.startsWith("/rest/v1/audit_log"),
    );
    expect(entry?.body).toMatchObject({
      actor_id: FAKE_USER_ID,
      action: "profile.set_locale",
      entity: "profile",
      entity_id: FAKE_USER_ID,
      details: { before: { locale: "es" }, after: { locale: "en" } },
    });
  });

  it("si el idioma ya era ese, no escribe nada", async () => {
    const supabase = stubSupabase();

    await action(
      buildArgs("/admin/idioma", { language: "es", from: "/admin" }),
    );

    expect(supabase.writes).toEqual([]);
  });

  it("un idioma que no existe responde 400 y no escribe", async () => {
    const supabase = stubSupabase();

    const response = await action(
      buildArgs("/admin/idioma", { language: "fr", from: "/admin" }),
    );

    expect(response).toMatchObject({ init: { status: 400 } });
    expect(supabase.writes).toEqual([]);
  });

  it.each([
    ["no tocó ningún perfil", { isProfileUpdateIgnored: true }],
    ["la base lo rechazó", { profileUpdateFailureStatus: 500 }],
    ["no se pudo leer el actual", { profileFailureStatus: 500 }],
  ])("no da por guardado el idioma si %s", async (_name, options) => {
    stubSupabase(options);

    await expect(
      action(buildArgs("/admin/idioma", TO_ENGLISH)),
    ).rejects.toThrow(/idioma/);
  });

  it("falla si la bitácora no recibe la entrada", async () => {
    stubSupabase({ auditFailureStatus: 500 });

    await expect(
      action(buildArgs("/admin/idioma", TO_ENGLISH)),
    ).rejects.toThrow(/bitácora/);
  });

  it("si la bitácora falla, devuelve el idioma a como estaba", async () => {
    const supabase = stubSupabase({ auditFailureStatus: 500 });

    await expect(
      action(buildArgs("/admin/idioma", TO_ENGLISH)),
    ).rejects.toThrow(/bitácora/);

    const updates = supabase.writes.filter(({ method }) => method === "PATCH");
    expect(updates.map(({ body }) => body)).toEqual([
      { locale: "en" },
      { locale: "es" },
    ]);
  });

  it("si tampoco puede devolverlo, informa los dos fallos y lo que quedó", async () => {
    stubSupabase({
      auditFailureStatus: 500,
      secondProfileUpdateFailureStatus: 500,
    });

    const thrown: unknown = await action(
      buildArgs("/admin/idioma", TO_ENGLISH),
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(AggregateError);
    const { message, errors } = thrown as AggregateError;
    expect(message).toContain('quedó en "en" sin entrada en la bitácora');
    expect(errors.map((error: Error) => error.message)).toEqual([
      expect.stringContaining("bitácora"),
      expect.stringContaining("idioma"),
    ]);
  });

  it("abrir la dirección sin enviar nada lleva al inicio del panel", () => {
    const response = loader({
      request: new Request("http://localhost/en/admin/language"),
    } as Parameters<typeof loader>[0]);

    expect(response.headers.get("Location")).toBe("/en/admin");
  });
});
