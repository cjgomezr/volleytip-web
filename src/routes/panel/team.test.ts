import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  FAKE_USER_ID,
  VALID_ACCESS_TOKEN,
} from "~/testing/fake-supabase";
import {
  NEW_ACCOUNT_ID,
  stubTeamApi,
  type FakeTeamApi,
  type FakeTeamRow,
} from "~/testing/fake-team-api";

import { TEST_ENV } from "../../../tests/support/test-env";
import { loader } from "./team";
import { action as activateAction } from "./team-activate";
import {
  action as deactivateAction,
  loader as confirmationLoader,
} from "./team-deactivate";
import { action as inviteAction } from "./team-invite";
import { action as roleAction } from "./team-role";

const SELF: FakeTeamRow = {
  id: FAKE_USER_ID,
  email: ADMIN_PROFILE.email,
  role: "admin",
  is_active: true,
  full_name: ADMIN_PROFILE.full_name,
};
const STAFF: FakeTeamRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "sara@example.com",
  role: "staff",
  is_active: true,
  full_name: "Sara Ruiz",
};
const OTHER_ADMIN: FakeTeamRow = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "mateo@example.com",
  role: "admin",
  is_active: true,
  full_name: "Mateo Gil",
};
const INACTIVE: FakeTeamRow = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "lina@example.com",
  role: "staff",
  is_active: false,
  full_name: "Lina Paz",
};
const BUYER: FakeTeamRow = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "compra@example.com",
  role: "buyer",
  is_active: true,
  full_name: null,
};
const TEAM = [SELF, STAFF, OTHER_ADMIN, INACTIVE, BUYER];
const MISSING_ID = "99999999-9999-4999-8999-999999999999";
const LAST_ADMIN_REJECTION =
  "profiles_last_admin_check: tiene que quedar al menos un admin activo";

interface Submission {
  readonly path?: string;
  readonly fields?: Record<string, string>;
  readonly memberId?: string;
}

function buildArgs<Args>({
  path = "/admin/equipo",
  fields,
  memberId,
}: Submission = {}): Args {
  const request = new Request(`http://localhost${path}`, {
    method: fields === undefined ? "GET" : "POST",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    body: fields === undefined ? undefined : new URLSearchParams(fields),
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  return { request, context, params: { memberId } } as unknown as Args;
}

function load(path?: string): ReturnType<typeof loader> {
  return loader(buildArgs({ path }));
}

function loadConfirmation(
  memberId: string,
): ReturnType<typeof confirmationLoader> {
  return confirmationLoader(buildArgs({ memberId }));
}

function invite(fields: Record<string, string>): Promise<unknown> {
  return inviteAction(buildArgs({ path: "/admin/equipo/invitar", fields }));
}

function changeRole(memberId: string, role: string): Promise<unknown> {
  return roleAction(buildArgs({ memberId, fields: { role } }));
}

function deactivate(
  memberId: string,
  fields: Record<string, string> = { confirm: "yes" },
): Promise<unknown> {
  return deactivateAction(buildArgs({ memberId, fields }));
}

function activate(memberId: string): Promise<unknown> {
  return activateAction(buildArgs({ memberId, fields: {} }));
}

/** El estado y el cuerpo de la respuesta de un `action`. */
function readResult(result: unknown): { status: number; body: unknown } {
  if (result instanceof Response) {
    return { status: result.status, body: result.headers.get("Location") };
  }
  const wrapped = result as {
    type?: string;
    data?: unknown;
    init?: ResponseInit;
  };
  if (wrapped.type === "DataWithResponseInit") {
    return { status: wrapped.init?.status ?? 200, body: wrapped.data };
  }
  return { status: 200, body: result };
}

function expectNothingWritten(api: FakeTeamApi): void {
  expect(api.createdAccounts).toEqual([]);
  expect(api.accountUpdates).toEqual([]);
  expect(api.teamUpdates).toEqual([]);
  expect(api.auditRows).toEqual([]);
}

function auditRow(
  action: string,
  entityId: string,
  details: { before: unknown; after: unknown },
): unknown {
  return expect.objectContaining({
    actor_id: FAKE_USER_ID,
    action,
    entity: "profile",
    entity_id: entityId,
    details,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("equipo: lista", () => {
  it("lista solo admin y staff, los activos primero y por nombre", async () => {
    stubTeamApi({ team: TEAM });

    const { members } = await load();

    expect(
      members.map(({ name, role, isActive }) => [name, role, isActive]),
    ).toEqual([
      ["Andrés Gómez", "admin", true],
      ["Mateo Gil", "admin", true],
      ["Sara Ruiz", "staff", true],
      ["Lina Paz", "staff", false],
    ]);
    expect(members.map(({ email }) => email)).not.toContain(BUYER.email);
  });

  it("muestra el último ingreso, o nada si nunca ha entrado", async () => {
    stubTeamApi({
      team: [SELF, STAFF],
      lastSignIns: { [SELF.id]: "2026-11-20T15:30:00Z" },
    });

    const { members } = await load();

    expect(members[0]?.lastSignIn).toEqual({
      dateTime: "2026-11-20T15:30:00Z",
      date: expect.stringContaining("20"),
    });
    expect(members[1]?.lastSignIn).toBeNull();
  });

  it("una cuenta que Auth no conoce sale sin ingreso y no tumba la lista", async () => {
    stubTeamApi({
      team: [SELF, STAFF],
      accountFailures: {
        [STAFF.id]: { status: 404, code: "user_not_found" },
      },
    });

    const { members } = await load();

    expect(members.map(({ lastSignIn }) => lastSignIn)).toEqual([null, null]);
  });

  it("si Auth falla, la lista no se inventa el último ingreso", async () => {
    stubTeamApi({
      team: [SELF],
      accountFailures: {
        [SELF.id]: { status: 500, code: "unexpected_failure" },
      },
    });

    await expect(load()).rejects.toThrow(/No se pudo leer el equipo/);
  });

  it.each([
    ["/admin/equipo", "https://sitio-de-prueba.volleytip.test/admin/entrar"],
    [
      "/en/admin/team",
      "https://sitio-de-prueba.volleytip.test/en/admin/sign-in",
    ],
  ])("en %s da la dirección completa de la entrada", async (path, url) => {
    stubTeamApi({ team: [SELF] });

    await expect(load(path)).resolves.toMatchObject({ signInUrl: url });
  });

  it("marca la fila de quien mira", async () => {
    stubTeamApi({ team: [SELF, STAFF] });

    const { members } = await load();

    expect(members.map(({ isSelf }) => isSelf)).toEqual([true, false]);
  });

  it.each([
    ["?aviso=invited", "invited"],
    ["?aviso=deactivated", "deactivated"],
    ["?aviso=otro", null],
    ["", null],
  ])("lee el aviso de la dirección %j", async (search, notice) => {
    stubTeamApi({ team: [SELF] });

    await expect(load(`/admin/equipo${search}`)).resolves.toMatchObject({
      notice,
    });
  });
});

describe("equipo: invitar", () => {
  const VALID = { name: "Nora Díaz", email: "nora@example.com", role: "staff" };

  it("un correo nuevo crea la cuenta confirmada con su rol y su nombre", async () => {
    const api = stubTeamApi({ team: [SELF] });

    const result = await invite(VALID);

    expect(readResult(result)).toEqual({
      status: 303,
      body: "/admin/equipo?aviso=invited",
    });
    expect(api.createdAccounts.map(({ body }) => body)).toEqual([
      { email: "nora@example.com", email_confirm: true },
    ]);
    expect(api.rows.find(({ id }) => id === NEW_ACCOUNT_ID)).toMatchObject({
      role: "staff",
      is_active: true,
      full_name: "Nora Díaz",
    });
    expect(api.teamUpdates[0]?.authorization).toBe(
      `Bearer ${VALID_ACCESS_TOKEN}`,
    );
    expect(api.auditRows).toEqual([
      auditRow("profile.invite", NEW_ACCOUNT_ID, {
        before: null,
        after: { role: "staff", is_active: true, full_name: "Nora Díaz" },
      }),
    ]);
  });

  it("un comprador sube de rol sin crear otra cuenta", async () => {
    const api = stubTeamApi({ team: [SELF, BUYER] });

    await invite({ name: "Pablo", email: BUYER.email, role: "admin" });

    expect(api.createdAccounts).toEqual([]);
    expect(api.accountUpdates).toEqual([
      expect.objectContaining({
        id: BUYER.id,
        body: { email_confirm: true, password: expect.any(String) },
      }),
    ]);
    expect(api.rows).toHaveLength(2);
    expect(api.rows[1]).toMatchObject({ id: BUYER.id, role: "admin" });
    expect(api.auditRows).toEqual([
      auditRow("profile.invite", BUYER.id, {
        before: { role: "buyer", full_name: null },
        after: { role: "admin", full_name: "Pablo" },
      }),
    ]);
  });

  it.each([
    ["activo", STAFF],
    ["desactivado", INACTIVE],
  ])("a quien ya es del equipo (%s) no le cambia nada", async (_name, row) => {
    const api = stubTeamApi({ team: [SELF, row] });

    const result = await invite({ ...VALID, email: row.email, role: "admin" });

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: {
        status: "alreadyMember",
        email: row.email,
        isActive: row.is_active,
      },
    });
    expectNothingWritten(api);
  });

  it("normaliza el correo y el nombre", async () => {
    const api = stubTeamApi({ team: [SELF] });

    await invite({
      ...VALID,
      name: "  Nora   Díaz ",
      email: "  Nora@Example.COM ",
    });

    expect(api.createdAccounts[0]?.body).toMatchObject({
      email: "nora@example.com",
    });
    expect(api.teamUpdates[0]?.body).toMatchObject({ full_name: "Nora Díaz" });
  });

  it("reconoce a un miembro aunque su correo llegue en mayúsculas", async () => {
    const api = stubTeamApi({ team: [SELF, STAFF] });

    const result = await invite({ ...VALID, email: " SARA@example.com " });

    expect(readResult(result).body).toMatchObject({ status: "alreadyMember" });
    expectNothingWritten(api);
  });

  it.each<[string, Record<string, string>, Record<string, string>]>([
    ["un correo vacío", { email: "  " }, { email: "required" }],
    ["un correo inválido", { email: "nora@" }, { email: "invalid" }],
    [
      "un correo demasiado largo",
      { email: `${"a".repeat(250)}@example.com` },
      { email: "invalid" },
    ],
    ["un nombre vacío", { name: "   " }, { name: "required" }],
    [
      "un nombre demasiado largo",
      { name: "a".repeat(121) },
      { name: "tooLong" },
    ],
    ["el rol buyer", { role: "buyer" }, { role: "invalid" }],
    ["un rol inventado", { role: "dueño" }, { role: "invalid" }],
    ["el rol vacío", { role: "" }, { role: "invalid" }],
  ])("con %s responde 400 junto al campo", async (_name, fields, errors) => {
    const api = stubTeamApi({ team: [SELF] });

    const result = await invite({ ...VALID, ...fields });

    expect(readResult(result)).toEqual({
      status: 400,
      body: {
        status: "invalid",
        fieldErrors: errors,
        values: { ...VALID, ...fields },
      },
    });
    expectNothingWritten(api);
  });
});

describe("equipo: rol y estado", () => {
  it.each([
    [STAFF, "admin"],
    [OTHER_ADMIN, "staff"],
  ])("cambia el rol de $full_name a %s", async (member, role) => {
    const api = stubTeamApi({ team: TEAM });

    const result = await changeRole(member.id, role);

    expect(readResult(result)).toEqual({
      status: 200,
      body: { status: "roleChanged", memberId: member.id, role },
    });
    expect(api.teamUpdates.map(({ body }) => body)).toEqual([{ role }]);
    expect(api.auditRows).toEqual([
      auditRow("profile.change_role", member.id, {
        before: { role: member.role },
        after: { role },
      }),
    ]);
  });

  it("con el mismo rol no escribe nada", async () => {
    const api = stubTeamApi({ team: TEAM });

    const result = await changeRole(STAFF.id, "staff");

    expect(readResult(result).body).toMatchObject({ status: "unchanged" });
    expectNothingWritten(api);
  });

  it("rechaza un rol que no es del equipo", async () => {
    const api = stubTeamApi({ team: TEAM });

    const result = await changeRole(STAFF.id, "buyer");

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: { status: "rejected", error: "malformed" },
    });
    expectNothingWritten(api);
  });

  it("desactivar sin confirmar lleva a la confirmación y no cambia nada", async () => {
    const api = stubTeamApi({ team: TEAM });

    const result = await deactivate(STAFF.id, {});

    expect(readResult(result)).toEqual({
      status: 303,
      body: `/admin/equipo/${STAFF.id}/desactivar`,
    });
    expectNothingWritten(api);
  });

  it("la confirmación dice a quién se va a desactivar", async () => {
    stubTeamApi({ team: TEAM });

    await expect(loadConfirmation(STAFF.id)).resolves.toEqual({
      member: { id: STAFF.id, name: "Sara Ruiz", email: STAFF.email },
    });
  });

  it.each([
    ["quien ya está desactivado", INACTIVE.id],
    ["quien mira", SELF.id],
  ])("la confirmación para %s vuelve a la lista", async (_name, memberId) => {
    stubTeamApi({ team: TEAM });

    const thrown = await loadConfirmation(memberId).catch(
      (error: unknown) => error,
    );

    expect(readResult(thrown)).toEqual({ status: 302, body: "/admin/equipo" });
  });

  it("confirmado, desactiva y deja la entrada", async () => {
    const api = stubTeamApi({ team: TEAM });

    const result = await deactivate(STAFF.id);

    expect(readResult(result)).toEqual({
      status: 303,
      body: "/admin/equipo?aviso=deactivated",
    });
    expect(api.teamUpdates.map(({ body }) => body)).toEqual([
      { is_active: false },
    ]);
    // Cambiar la contraseña por id cierra las sesiones de esa cuenta.
    expect(api.accountUpdates).toEqual([
      expect.objectContaining({
        id: STAFF.id,
        body: { email_confirm: true, password: expect.any(String) },
      }),
    ]);
    expect(api.auditRows).toEqual([
      auditRow("profile.deactivate", STAFF.id, {
        before: { is_active: true },
        after: { is_active: false },
      }),
    ]);
  });

  it("vuelve a activar a un desactivado y deja la entrada", async () => {
    const api = stubTeamApi({ team: TEAM });

    const result = await activate(INACTIVE.id);

    expect(readResult(result).body).toEqual({
      status: "activated",
      memberId: INACTIVE.id,
    });
    expect(api.auditRows).toEqual([
      auditRow("profile.activate", INACTIVE.id, {
        before: { is_active: false },
        after: { is_active: true },
      }),
    ]);
  });

  it("si no se pueden cerrar las sesiones, igual desactiva y registra", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = stubTeamApi({
      team: TEAM,
      accountUpdateFailure: { status: 500, code: "unexpected_failure" },
    });

    const result = await deactivate(STAFF.id);

    expect(readResult(result).status).toBe(303);
    expect(api.auditRows).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(STAFF.id),
      expect.anything(),
    );
    log.mockRestore();
  });

  it("al activar cierra las sesiones viejas", async () => {
    const api = stubTeamApi({ team: TEAM });

    await activate(INACTIVE.id);

    expect(api.accountUpdates.map(({ id }) => id)).toEqual([INACTIVE.id]);
  });

  it("si no puede cerrarlas, no activa", async () => {
    const api = stubTeamApi({
      team: TEAM,
      accountUpdateFailure: { status: 500, code: "unexpected_failure" },
    });

    await expect(activate(INACTIVE.id)).rejects.toThrow(
      /cambiar el acceso de la cuenta/,
    );
    expect(api.teamUpdates).toEqual([]);
    expect(api.auditRows).toEqual([]);
  });

  it("activar a quien ya está activo no escribe nada", async () => {
    const api = stubTeamApi({ team: TEAM });

    await activate(STAFF.id);

    expectNothingWritten(api);
  });

  it.each([
    ["desactivar", () => deactivate(OTHER_ADMIN.id)],
    ["pasar a staff", () => changeRole(OTHER_ADMIN.id, "staff")],
  ])(
    "si la base rechaza %s al último admin, lo explica sin registrar nada",
    async (_name, submit) => {
      const api = stubTeamApi({
        team: TEAM,
        updateRejection: LAST_ADMIN_REJECTION,
      });

      const result = await submit();

      expect(readResult(result)).toEqual({
        status: 400,
        body: {
          status: "rejected",
          memberId: OTHER_ADMIN.id,
          error: "lastAdmin",
        },
      });
      expect(api.auditRows).toEqual([]);
    },
  );

  it("otro fallo de la base se lanza", async () => {
    stubTeamApi({ team: TEAM, updateRejection: "se cayó el disco" });

    await expect(deactivate(STAFF.id)).rejects.toThrow(/se cayó el disco/);
  });

  it.each([
    ["un comprador", BUYER.id],
    ["un id que no existe", MISSING_ID],
    ["un id mal formado", "abc"],
  ])("para %s responde 404 y no escribe", async (_name, memberId) => {
    const api = stubTeamApi({ team: TEAM });

    for (const submit of [
      () => changeRole(memberId, "admin"),
      () => deactivate(memberId),
      () => activate(memberId),
    ]) {
      await expect(submit()).rejects.toMatchObject({ init: { status: 404 } });
    }
    expectNothingWritten(api);
  });
});

describe("equipo: cambios a la vez", () => {
  /** Lo que otra persona hace justo antes de que llegue la escritura. */
  function changeRow(
    id: string,
    changes: Partial<FakeTeamRow>,
  ): (rows: FakeTeamRow[]) => void {
    return (rows) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (row !== undefined) Object.assign(row, changes);
    };
  }

  it("invitar a un comprador que otro acaba de subir no le pisa el rol", async () => {
    const api = stubTeamApi({
      team: [SELF, BUYER],
      beforeUpdate: changeRow(BUYER.id, { role: "staff" }),
    });

    const result = await invite({
      name: "Pablo",
      email: BUYER.email,
      role: "admin",
    });

    expect(readResult(result).body).toMatchObject({ status: "alreadyMember" });
    expect(api.rows[1]).toMatchObject({ role: "staff", full_name: null });
    expect(api.auditRows).toEqual([]);
  });

  it.each([
    ["creó y subió", "staff", "alreadyMember"],
    ["solo creó", "buyer", undefined],
  ] as const)(
    "si otra invitación %s la cuenta nueva, no falla",
    async (_name, role, status) => {
      const concurrentAccount = { ...BUYER, role };
      const api = stubTeamApi({ team: [SELF], concurrentAccount });

      const result = await invite({
        name: "Pablo",
        email: BUYER.email,
        role: "admin",
      });

      if (status === undefined) {
        expect(readResult(result).status).toBe(303);
        expect(api.rows[1]).toMatchObject({ role: "admin" });
        expect(api.auditRows).toHaveLength(1);
      } else {
        expect(readResult(result).body).toMatchObject({ status });
        expect(api.auditRows).toEqual([]);
      }
    },
  );

  it("un fallo al crear la cuenta que no es por repetida se lanza", async () => {
    stubTeamApi({ team: [SELF], createFailure: true });

    await expect(
      invite({ name: "N", email: "n@example.com", role: "staff" }),
    ).rejects.toThrow(/crear la cuenta/);
  });

  it.each<[string, FakeTeamRow, Partial<FakeTeamRow>, () => Promise<unknown>]>([
    [
      "cambiar el rol",
      STAFF,
      { role: "admin" },
      () => changeRole(STAFF.id, "admin"),
    ],
    ["desactivar", STAFF, { is_active: false }, () => deactivate(STAFF.id)],
    ["activar", INACTIVE, { is_active: true }, () => activate(INACTIVE.id)],
  ])(
    "%s sobre una fila que ya cambió no registra nada",
    async (_name, member, changes, submit) => {
      const api = stubTeamApi({
        team: TEAM,
        beforeUpdate: changeRow(member.id, changes),
      });

      await submit();

      expect(api.teamUpdates).toHaveLength(1);
      expect(api.auditRows).toEqual([]);
    },
  );
});

describe("equipo: bitácora", () => {
  it.each<[string, () => Promise<unknown>]>([
    [
      "profile.invite",
      () => invite({ name: "N", email: "n@example.com", role: "staff" }),
    ],
    ["profile.change_role", () => changeRole(STAFF.id, "admin")],
    ["profile.deactivate", () => deactivate(STAFF.id)],
    ["profile.activate", () => activate(INACTIVE.id)],
  ])("%s deja una sola entrada con quién la hizo", async (action, submit) => {
    const api = stubTeamApi({ team: TEAM });

    await submit();

    expect(api.auditRows).toEqual([
      expect.objectContaining({ actor_id: FAKE_USER_ID, action }),
    ]);
  });
});

describe("equipo: a sí mismo", () => {
  it.each<[string, (id: string) => Promise<unknown>]>([
    ["desactivarse", (id) => deactivate(id)],
    ["desactivarse sin confirmar", (id) => deactivate(id, {})],
    [
      "desactivarse con el id en mayúsculas",
      (id) => deactivate(id.toUpperCase()),
    ],
    ["bajarse el rol", (id) => changeRole(id, "staff")],
    [
      "bajarse el rol con el id en mayúsculas",
      (id) => changeRole(id.toUpperCase(), "staff"),
    ],
  ])("el servidor rechaza %s", async (_name, submit) => {
    const api = stubTeamApi({ team: TEAM });

    const result = await submit(SELF.id);

    expect(readResult(result)).toEqual({
      status: 400,
      body: { status: "rejected", memberId: SELF.id, error: "self" },
    });
    expectNothingWritten(api);
  });
});

describe("equipo: permisos", () => {
  const SUBMISSIONS: readonly [string, () => Promise<unknown>][] = [
    ["leer la lista", () => load()],
    ["leer la confirmación", () => loadConfirmation(STAFF.id)],
    [
      "invitar",
      () => invite({ name: "N", email: "n@example.com", role: "admin" }),
    ],
    ["cambiar un rol", () => changeRole(STAFF.id, "admin")],
    ["desactivar", () => deactivate(STAFF.id)],
    ["activar", () => activate(INACTIVE.id)],
  ];

  it.each(SUBMISSIONS)("un staff no puede %s", async (_name, submit) => {
    const api = stubTeamApi({
      team: TEAM,
      profile: { ...ADMIN_PROFILE, role: "staff" },
    });

    const thrown = await submit().catch((error: unknown) => error);

    expect(readResult(thrown)).toEqual({ status: 302, body: "/admin" });
    expectNothingWritten(api);
  });

  it.each(SUBMISSIONS)("un comprador no puede %s", async (_name, submit) => {
    const api = stubTeamApi({
      team: TEAM,
      profile: { ...ADMIN_PROFILE, role: "buyer" },
    });

    await expect(submit()).rejects.toMatchObject({ init: { status: 404 } });
    expectNothingWritten(api);
  });
});
