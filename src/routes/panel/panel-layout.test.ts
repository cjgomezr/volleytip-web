import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { panelMemberContext } from "~/lib/panel/panel-middleware.server";
import type { PanelMember } from "~/lib/panel/visitor.server";

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
  return { context, params: {} } as unknown as Parameters<typeof loader>[0];
}

function stubSettings(rows: readonly unknown[]): string[] {
  const requests: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init).url);
    return Promise.resolve(Response.json(rows));
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
      pendingCounts: {},
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

  it("el staff no recibe cáscara ni consulta los ajustes", async () => {
    const requests = stubSettings(MAINTENANCE_ON);

    await expect(
      loader(buildArgs({ ...ADMIN, role: "staff" })),
    ).resolves.toEqual({ view: "staff" });
    expect(requests).toEqual([]);
  });
});
