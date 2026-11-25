import { describe, expect, it } from "vitest";

import {
  MAINTENANCE_MODE_KEY,
  MAINTENANCE_MODE_SETTING,
  MAINTENANCE_RETRY_AFTER_SECONDS,
  applyMaintenanceHeaders,
  buildMaintenanceNotice,
  isExemptFromMaintenance,
  pickReturnTime,
} from "./maintenance-mode.server";

describe("ajuste de mantenimiento", () => {
  const { isValid } = MAINTENANCE_MODE_SETTING;

  it("usa la clave maintenance_mode", () => {
    expect(MAINTENANCE_MODE_SETTING.key).toBe(MAINTENANCE_MODE_KEY);
    expect(MAINTENANCE_MODE_KEY).toBe("maintenance_mode");
  });

  it("acepta encendido, apagado y encendido con hora", () => {
    expect(isValid({ enabled: true })).toBe(true);
    expect(isValid({ enabled: false })).toBe(true);
    expect(isValid({ enabled: true, returnsAt: "2026-12-01T15:00:00Z" })).toBe(
      true,
    );
  });

  it("cuando el ajuste no existe, el modo está apagado", () => {
    expect(MAINTENANCE_MODE_SETTING.fallback).toEqual({ enabled: false });
  });

  it.each([
    ["una cadena", "encendido"],
    ["nulo", null],
    ["sin enabled", {}],
    ["enabled que no es booleano", { enabled: "yes" }],
    ["hora que no es cadena", { enabled: true, returnsAt: 5 }],
    ["hora que no es una fecha", { enabled: true, returnsAt: "manana" }],
  ])("rechaza una forma inválida: %s", (_case, value) => {
    expect(isValid(value)).toBe(false);
  });
});

describe("qué direcciones quedan fuera", () => {
  it.each([
    "/healthz",
    "/.well-known/assetlinks.json",
    "/admin",
    "/admin/pedidos",
    "/HEALTHZ",
    "/Admin/pedidos",
    "/en/admin",
    "/en/admin/sign-in",
    "/EN/Admin",
  ])("deja libre %s", (path) => {
    expect(isExemptFromMaintenance(path)).toBe(true);
  });

  it.each([
    "/",
    "/en/",
    "/administracion",
    "/healthzz",
    "/tienda",
    "/en/administration",
  ])("no deja libre %s", (path) => {
    expect(isExemptFromMaintenance(path)).toBe(false);
  });
});

describe("hora de regreso", () => {
  const now = new Date("2026-12-01T12:00:00Z");

  it("devuelve la hora cuando sigue en el futuro", () => {
    expect(
      pickReturnTime({ enabled: true, returnsAt: "2026-12-01T15:00:00Z" }, now),
    ).toBe("2026-12-01T15:00:00Z");
  });

  it("no devuelve nada sin hora", () => {
    expect(pickReturnTime({ enabled: true }, now)).toBeNull();
  });

  it("no devuelve nada cuando la hora ya pasó", () => {
    expect(
      pickReturnTime({ enabled: true, returnsAt: "2026-12-01T11:00:00Z" }, now),
    ).toBeNull();
  });

  it("arma el aviso con la hora ya decidida", () => {
    expect(buildMaintenanceNotice({ enabled: true }, now)).toEqual({
      kind: "maintenance",
      returnsAt: null,
    });
  });
});

describe("cabeceras de mantenimiento", () => {
  it("lleva Retry-After, noindex y no-store", () => {
    const headers = new Headers();

    applyMaintenanceHeaders(headers);

    expect(headers.get("Retry-After")).toBe(
      String(MAINTENANCE_RETRY_AFTER_SECONDS),
    );
    expect(headers.get("X-Robots-Tag")).toBe("noindex");
    expect(headers.get("Cache-Control")).toBe("no-store");
  });
});
