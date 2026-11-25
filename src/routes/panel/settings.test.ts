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
import {
  action as maintenanceAction,
  loader as maintenanceLoader,
} from "./maintenance";
import { action as appAction, loader as settingsLoader } from "./settings";

const APP_STORE = "https://apps.apple.com/co/app/volleytip/id123";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.vt";
const SETTINGS_PATH = "/admin/ajustes";
const MAINTENANCE_PATH = "/admin/ajustes/mantenimiento";
const RETURNS_AT = "2027-01-01T10:00:00Z";

const MEMBER: PanelMember = {
  id: FAKE_USER_ID,
  email: ADMIN_PROFILE.email,
  fullName: ADMIN_PROFILE.full_name,
  role: "admin",
};

function buildArgs<Args>(path: string, fields?: Record<string, string>): Args {
  const request = new Request(`http://localhost${path}`, {
    method: fields === undefined ? "GET" : "POST",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    ...(fields === undefined ? {} : { body: new URLSearchParams(fields) }),
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  context.set(panelMemberContext, MEMBER);
  return { request, context, params: {} } as unknown as Args;
}

function submitMaintenance(
  fields: Record<string, string>,
  path = MAINTENANCE_PATH,
): ReturnType<typeof maintenanceAction> {
  return maintenanceAction(buildArgs(path, fields));
}

function submitApp(
  fields: Record<string, string>,
  path = SETTINGS_PATH,
): ReturnType<typeof appAction> {
  return appAction(buildArgs(path, fields));
}

function catchThrown(work: () => Promise<unknown>): Promise<unknown> {
  return work().catch((error: unknown) => error);
}

function expectRedirect(result: unknown, location: string): void {
  expect(result).toBeInstanceOf(Response);
  expect((result as Response).status).toBe(303);
  expect((result as Response).headers.get("Location")).toBe(location);
}

/** El estado y los errores de una respuesta `data()`. */
function readRejection(result: unknown): {
  status: number | undefined;
  errors: Record<string, string>;
  values: Record<string, string>;
} {
  const { data, init } = result as {
    data: { errors: Record<string, string>; values: Record<string, string> };
    init: ResponseInit;
  };
  return { status: init.status, ...data };
}

const MAINTENANCE_OFF = { maintenance_mode: { enabled: false } };
const MAINTENANCE_ON = { maintenance_mode: { enabled: true } };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ajustes: mantenimiento", () => {
  it("muestra el estado actual del mantenimiento y de la app", async () => {
    stubSupabase({
      settings: {
        ...MAINTENANCE_ON,
        app_availability: { status: "available", appStoreUrl: APP_STORE },
      },
    });

    const data = await settingsLoader(buildArgs(SETTINGS_PATH));

    expect(data.maintenance).toBe("on");
    expect(data.app).toEqual({
      state: "available",
      values: {
        status: "available",
        appStoreUrl: APP_STORE,
        playStoreUrl: "",
      },
    });
  });

  it("sin filas, el mantenimiento está apagado y la app en lista de espera", async () => {
    stubSupabase();

    const data = await settingsLoader(buildArgs(SETTINGS_PATH));

    expect(data.maintenance).toBe("off");
    expect(data.app.state).toBe("waitlist");
    expect(data.saved).toBeNull();
  });

  it.each(["maintenance", "app"])("avisa que se guardó %s", async (saved) => {
    stubSupabase();

    const data = await settingsLoader(
      buildArgs(`${SETTINGS_PATH}?saved=${saved}`),
    );

    expect(data.saved).toBe(saved);
  });

  it("encender sin confirmar no cambia nada y lleva a la confirmación", async () => {
    const supabase = stubSupabase({ settings: MAINTENANCE_OFF });

    const result = await submitMaintenance({ enabled: "true" });

    expectRedirect(result, MAINTENANCE_PATH);
    expect(supabase.settingsWrites).toEqual([]);
    expect(supabase.auditRows).toEqual([]);
  });

  it("confirmado, enciende con la sesión de la persona", async () => {
    const supabase = stubSupabase({ settings: MAINTENANCE_OFF });

    const result = await submitMaintenance({ enabled: "true", confirm: "yes" });

    expectRedirect(result, `${SETTINGS_PATH}?saved=maintenance`);
    const [write] = supabase.settingsWrites;
    expect(write?.body).toEqual({
      key: "maintenance_mode",
      value: { enabled: true },
    });
    expect(write?.authorization).toContain("acceso-vigente");
  });

  it("al encender conserva la hora de regreso guardada", async () => {
    const supabase = stubSupabase({
      settings: {
        maintenance_mode: { enabled: false, returnsAt: RETURNS_AT },
      },
    });

    await submitMaintenance({ enabled: "true", confirm: "yes" });

    expect(supabase.settingsWrites[0]?.body).toMatchObject({
      value: { enabled: true, returnsAt: RETURNS_AT },
    });
  });

  it("apagar no pide confirmación y descarta la hora de regreso", async () => {
    const supabase = stubSupabase({
      settings: { maintenance_mode: { enabled: true, returnsAt: RETURNS_AT } },
    });

    const result = await submitMaintenance({ enabled: "false" });

    expectRedirect(result, `${SETTINGS_PATH}?saved=maintenance`);
    expect(supabase.settingsWrites[0]?.body).toEqual({
      key: "maintenance_mode",
      value: { enabled: false },
    });
  });

  it("en inglés redirige a las direcciones en inglés", async () => {
    stubSupabase({ settings: MAINTENANCE_OFF });
    const path = "/en/admin/settings/maintenance";

    const unconfirmed = await submitMaintenance({ enabled: "true" }, path);
    const confirmed = await submitMaintenance(
      { enabled: "true", confirm: "yes" },
      path,
    );

    expectRedirect(unconfirmed, path);
    expectRedirect(confirmed, "/en/admin/settings?saved=maintenance");
  });

  it.each<Record<string, string>>([{}, { enabled: "si" }])(
    "un envío sin un estado válido (%o) responde 400 y no escribe",
    async (fields) => {
      const supabase = stubSupabase();

      const result = await submitMaintenance(fields);

      expect(result).toMatchObject({ init: { status: 400 } });
      expect(supabase.settingsWrites).toEqual([]);
    },
  );

  it("la confirmación con el modo ya encendido vuelve a ajustes", async () => {
    stubSupabase({ settings: MAINTENANCE_ON });

    const thrown = await catchThrown(() =>
      maintenanceLoader(buildArgs(MAINTENANCE_PATH)),
    );

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("Location")).toBe(SETTINGS_PATH);
  });

  it("si la base rechaza la escritura, falla sin dejar entrada", async () => {
    const supabase = stubSupabase({ settingsWriteFailureStatus: 403 });

    await expect(
      submitMaintenance({ enabled: "true", confirm: "yes" }),
    ).rejects.toThrow(/maintenance_mode/);
    expect(supabase.auditRows).toEqual([]);
  });

  it("si no se puede leer el ajuste, la pantalla falla en vez de inventarlo", async () => {
    stubSupabase({ settingsReadFailureStatus: 500 });

    await expect(settingsLoader(buildArgs(SETTINGS_PATH))).rejects.toThrow(
      /maintenance_mode/,
    );
  });
});

describe("ajustes: estado de la app", () => {
  it("guarda lista de espera sin direcciones", async () => {
    const supabase = stubSupabase();

    const result = await submitApp({
      status: "waitlist",
      appStoreUrl: "",
      playStoreUrl: "",
    });

    expectRedirect(result, `${SETTINGS_PATH}?saved=app`);
    expect(supabase.settingsWrites[0]?.body).toEqual({
      key: "app_availability",
      value: { status: "waitlist" },
    });
  });

  it("en lista de espera conserva las direcciones que ya estaban", async () => {
    const supabase = stubSupabase({
      settings: {
        app_availability: {
          status: "available",
          appStoreUrl: APP_STORE,
          playStoreUrl: PLAY_STORE,
        },
      },
    });

    await submitApp({ status: "waitlist" });

    expect(supabase.settingsWrites[0]?.body).toMatchObject({
      value: {
        status: "waitlist",
        appStoreUrl: APP_STORE,
        playStoreUrl: PLAY_STORE,
      },
    });
  });

  it("disponible sin ninguna dirección responde 400 junto a los campos", async () => {
    const supabase = stubSupabase();

    const result = await submitApp({
      status: "available",
      appStoreUrl: "  ",
      playStoreUrl: "",
    });

    const { status, errors } = readRejection(result);
    expect(status).toBe(400);
    expect(errors).toEqual({
      appStoreUrl: "panel.settings.app.error.missingUrl",
    });
    expect(supabase.settingsWrites).toEqual([]);
    expect(supabase.auditRows).toEqual([]);
  });

  it("disponible no hereda la dirección guardada si el campo se vació", async () => {
    const supabase = stubSupabase({
      settings: {
        app_availability: { status: "available", appStoreUrl: APP_STORE },
      },
    });

    const result = await submitApp({ status: "available", appStoreUrl: "" });

    expect(readRejection(result).status).toBe(400);
    expect(supabase.settingsWrites).toEqual([]);
  });

  it.each([
    ["appStoreUrl", "http://apps.apple.com/co/app/id123"],
    ["appStoreUrl", "https://apps.apple.com.sitio-ajeno.test/id123"],
    ["appStoreUrl", "https://sitio-ajeno.test/https://apps.apple.com/"],
    ["appStoreUrl", PLAY_STORE],
    ["appStoreUrl", "https://apps.apple.com/co/app/una app"],
    ["appStoreUrl", "apps.apple.com/co/app/id123"],
    ["appStoreUrl", `https://apps.apple.com/${"a".repeat(2100)}`],
    ["playStoreUrl", "http://play.google.com/store/apps"],
    ["playStoreUrl", APP_STORE],
    ["playStoreUrl", "no es una dirección"],
  ])("rechaza %s = %s", async (field, url) => {
    for (const status of ["available", "waitlist"]) {
      const supabase = stubSupabase();

      const result = await submitApp({ status, [field]: url });

      const rejection = readRejection(result);
      expect(rejection.status).toBe(400);
      expect(Object.keys(rejection.errors)).toEqual([field]);
      expect(rejection.values).toMatchObject({ status, [field]: url });
      expect(supabase.settingsWrites).toEqual([]);
    }
  });

  it.each([
    [{ appStoreUrl: APP_STORE }],
    [{ playStoreUrl: PLAY_STORE }],
    [{ appStoreUrl: APP_STORE, playStoreUrl: PLAY_STORE }],
  ])("acepta disponible con %o", async (urls: Record<string, string>) => {
    const supabase = stubSupabase();

    const result = await submitApp({ status: "available", ...urls });

    expectRedirect(result, `${SETTINGS_PATH}?saved=app`);
    expect(supabase.settingsWrites[0]?.body).toEqual({
      key: "app_availability",
      value: { status: "available", ...urls },
    });
  });

  it("quita los espacios de los extremos antes de guardar", async () => {
    const supabase = stubSupabase();

    await submitApp({ status: "available", appStoreUrl: ` ${APP_STORE} ` });

    expect(supabase.settingsWrites[0]?.body).toMatchObject({
      value: { appStoreUrl: APP_STORE },
    });
  });

  it("un estado que no existe responde 400 junto al campo", async () => {
    const supabase = stubSupabase();

    const result = await submitApp({ status: "pronto" });

    const { status, errors } = readRejection(result);
    expect(status).toBe(400);
    expect(errors).toEqual({ status: "panel.settings.app.error.status" });
    expect(supabase.settingsWrites).toEqual([]);
  });
});

describe("ajustes: bitácora", () => {
  it("el mantenimiento registra el antes y el después", async () => {
    const supabase = stubSupabase({ settings: MAINTENANCE_OFF });

    await submitMaintenance({ enabled: "true", confirm: "yes" });

    expect(supabase.auditRows).toEqual([
      expect.objectContaining({
        actor_id: FAKE_USER_ID,
        action: "settings.set_maintenance",
        entity: "settings",
        entity_id: null,
        details: {
          key: "maintenance_mode",
          before: { value: { enabled: false } },
          after: { value: { enabled: true } },
        },
      }),
    ]);
  });

  it("el estado de la app registra el antes y el después", async () => {
    const supabase = stubSupabase({
      settings: { app_availability: { status: "waitlist" } },
    });

    await submitApp({ status: "available", appStoreUrl: APP_STORE });

    expect(supabase.auditRows).toEqual([
      expect.objectContaining({
        action: "settings.set_app_availability",
        details: {
          key: "app_availability",
          before: { value: { status: "waitlist" } },
          after: { value: { status: "available", appStoreUrl: APP_STORE } },
        },
      }),
    ]);
  });

  it("el primer guardado de un ajuste queda sin antes", async () => {
    const supabase = stubSupabase();

    await submitApp({ status: "waitlist" });

    expect(supabase.auditRows[0]).toMatchObject({
      details: { before: null, after: { value: { status: "waitlist" } } },
    });
  });

  it("guardar lo que ya estaba no escribe ni deja entrada", async () => {
    const supabase = stubSupabase({
      settings: {
        app_availability: { status: "waitlist" },
        ...MAINTENANCE_OFF,
      },
    });

    await submitApp({ status: "waitlist" });
    await submitMaintenance({ enabled: "false" });

    expect(supabase.settingsWrites).toEqual([]);
    expect(supabase.auditRows).toEqual([]);
  });
});

describe("ajustes: valor inválido en la base", () => {
  const BROKEN = {
    maintenance_mode: { enabled: "si" },
    app_availability: {
      status: "available",
      appStoreUrl: "http://sitio-ajeno.test",
      playStoreUrl: PLAY_STORE,
    },
  };

  it("la pantalla abre, los marca inválidos y muestra lo guardado", async () => {
    stubSupabase({ settings: BROKEN });

    const data = await settingsLoader(buildArgs(SETTINGS_PATH));

    expect(data.maintenance).toBe("invalid");
    expect(data.app).toEqual({
      state: "invalid",
      values: {
        status: "available",
        appStoreUrl: "http://sitio-ajeno.test",
        playStoreUrl: PLAY_STORE,
      },
    });
  });

  it.each([null, "texto", 3, [], { status: "otro" }, { status: "available" }])(
    "abre con el estado de la app guardado como %o",
    async (value) => {
      stubSupabase({ settings: { app_availability: value } });

      const data = await settingsLoader(buildArgs(SETTINGS_PATH));

      expect(data.app.state).toBe("invalid");
    },
  );

  it.each(["false", "true"])(
    "deja corregir el mantenimiento con enabled=%s",
    async (enabled) => {
      const supabase = stubSupabase({ settings: BROKEN });

      await submitMaintenance({ enabled, confirm: "yes" });

      expect(supabase.settingsWrites[0]?.body).toMatchObject({
        value: { enabled: enabled === "true" },
      });
      expect(supabase.auditRows[0]).toMatchObject({
        details: { before: { value: { enabled: "si" } } },
      });
    },
  );

  it("la confirmación abre con un mantenimiento inválido", async () => {
    stubSupabase({ settings: BROKEN });

    await expect(
      maintenanceLoader(buildArgs(MAINTENANCE_PATH)),
    ).resolves.toBeNull();
  });

  it("deja corregir el estado de la app y conserva la dirección sana", async () => {
    const supabase = stubSupabase({ settings: BROKEN });

    await submitApp({ status: "waitlist", appStoreUrl: "", playStoreUrl: "" });

    expect(supabase.settingsWrites[0]?.body).toEqual({
      key: "app_availability",
      value: { status: "waitlist", playStoreUrl: PLAY_STORE },
    });
  });
});

describe("ajustes: permisos", () => {
  const SUBMISSIONS: readonly [string, () => Promise<unknown>][] = [
    [
      "el mantenimiento",
      () => submitMaintenance({ enabled: "true", confirm: "yes" }),
    ],
    ["el estado de la app", () => submitApp({ status: "waitlist" })],
  ];

  it.each(SUBMISSIONS)("un buyer no escribe %s", async (_name, submit) => {
    const supabase = stubSupabase({
      profile: { ...ADMIN_PROFILE, role: "buyer" },
    });

    const thrown = await catchThrown(submit);

    expect(thrown).toMatchObject({ init: { status: 404 } });
    expect(supabase.settingsWrites).toEqual([]);
    expect(supabase.auditRows).toEqual([]);
  });

  it.each(SUBMISSIONS)("el staff no escribe %s", async (_name, submit) => {
    const supabase = stubSupabase({
      profile: { ...ADMIN_PROFILE, role: "staff" },
    });

    const thrown = await catchThrown(submit);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("Location")).toBe("/admin");
    expect(supabase.settingsWrites).toEqual([]);
    expect(supabase.auditRows).toEqual([]);
  });
});
