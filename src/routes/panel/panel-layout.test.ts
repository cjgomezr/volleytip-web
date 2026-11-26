import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  panelMemberContext,
  panelSessionContext,
} from "~/lib/panel/panel-middleware.server";
import type { PanelMember } from "~/lib/panel/visitor.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import { SAMPLE_MESSAGE } from "~/testing/fake-messages-table";
import {
  buildSessionCookie,
  stubSupabase,
  VALID_ACCESS_TOKEN,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";

import { loader } from "./member-layout";

const ADMIN: PanelMember = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  email: "andres@prueba.volleytip.test",
  fullName: "Andrés Gómez",
  role: "admin",
};

function buildArgs(member: PanelMember): Parameters<typeof loader>[0] {
  const context = new RouterContextProvider();
  context.set(panelMemberContext, member);
  const request = new Request("http://localhost/admin", {
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
  });
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  return { request, context, params: {} } as unknown as Parameters<
    typeof loader
  >[0];
}

/** Responde los ajustes con esas filas y cero mensajes nuevos. */
function stubSettings(rows: readonly unknown[]): Request[] {
  const requests: Request[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    return Promise.resolve(
      request.method === "HEAD"
        ? new Response(null, { headers: { "Content-Range": "*/0" } })
        : Response.json(rows),
    );
  });
  return requests;
}

const MAINTENANCE_ON = [{ key: "maintenance_mode", value: { enabled: true } }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("datos de la cáscara del panel", () => {
  it("entrega el nombre y el rol de quien entró", async () => {
    stubSettings([]);

    await expect(loader(buildArgs(ADMIN))).resolves.toEqual({
      view: "admin",
      member: { displayName: "Andrés Gómez", role: "admin" },
      pendingCounts: { messages: 0 },
      isMaintenanceOn: false,
    });
  });

  it("sin nombre entrega el correo", async () => {
    stubSettings([]);

    await expect(
      loader(buildArgs({ ...ADMIN, fullName: null })),
    ).resolves.toMatchObject({ member: { displayName: ADMIN.email } });
  });

  it("lee el modo mantenimiento aunque el panel esté exento", async () => {
    stubSettings(MAINTENANCE_ON);

    await expect(loader(buildArgs(ADMIN))).resolves.toMatchObject({
      isMaintenanceOn: true,
    });
  });

  it("bandeja: módulo: entrega cuántos mensajes nuevos hay", async () => {
    stubSupabase({
      messages: [
        SAMPLE_MESSAGE,
        { ...SAMPLE_MESSAGE, id: "2" },
        { ...SAMPLE_MESSAGE, id: "3", status: "answered" },
      ],
    });

    await expect(loader(buildArgs(ADMIN))).resolves.toMatchObject({
      pendingCounts: { messages: 2 },
    });
  });

  it("bandeja: módulo: si el conteo falla, el panel abre sin el número y queda en el registro", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubSupabase({ messagesReadFailureStatus: 500 });

    await expect(loader(buildArgs(ADMIN))).resolves.toMatchObject({
      view: "admin",
      pendingCounts: {},
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("lee los ajustes con la sesión de la persona", async () => {
    const requests = stubSettings([]);

    await loader(buildArgs(ADMIN));

    const authorizations = requests.map(({ headers }) =>
      headers.get("authorization"),
    );
    expect(authorizations).toEqual(
      Array(2).fill(`Bearer ${VALID_ACCESS_TOKEN}`),
    );
  });

  it("el staff no recibe cáscara ni consulta los ajustes ni los mensajes", async () => {
    const requests = stubSettings(MAINTENANCE_ON);

    await expect(
      loader(buildArgs({ ...ADMIN, role: "staff" })),
    ).resolves.toEqual({ view: "staff" });
    expect(requests).toEqual([]);
  });
});
