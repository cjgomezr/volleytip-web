import type { MaintenanceNotice } from "./maintenance-notice";
import type { SettingDefinition } from "./settings.server";

export const MAINTENANCE_MODE_KEY = "maintenance_mode";

/** Cuánto pide el 503 que esperen los buscadores y los clientes antes de
 * volver a preguntar. */
export const MAINTENANCE_RETRY_AFTER_SECONDS = 300;

/** La forma del ajuste `settings.maintenance_mode`: encendido, y de forma
 * opcional la hora estimada de regreso (texto ISO 8601). */
export interface MaintenanceMode {
  readonly enabled: boolean;
  readonly returnsAt?: string;
}

export const MAINTENANCE_MODE_SETTING: SettingDefinition<MaintenanceMode> = {
  key: MAINTENANCE_MODE_KEY,
  isValid: (value): value is MaintenanceMode => {
    if (typeof value !== "object" || value === null || !("enabled" in value)) {
      return false;
    }
    if (typeof value.enabled !== "boolean") return false;
    if (!("returnsAt" in value) || value.returnsAt === undefined) return true;
    return (
      typeof value.returnsAt === "string" &&
      !Number.isNaN(new Date(value.returnsAt).getTime())
    );
  },
  fallback: { enabled: false },
};

// Direcciones que siguen respondiendo con el modo encendido. Van por
// segmento completo: `/administracion` no queda fuera por empezar parecido.
// Los webhooks de pago agregan la suya aquí (W6b).
const EXEMPT_PREFIXES = ["/healthz", "/.well-known", "/admin"] as const;

export function isExemptFromMaintenance(pathname: string): boolean {
  return EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** La hora de regreso que vale la pena mostrar: la que sigue en el futuro. */
export function pickReturnTime(
  mode: MaintenanceMode,
  now: Date,
): string | null {
  if (mode.returnsAt === undefined) return null;
  return new Date(mode.returnsAt).getTime() > now.getTime()
    ? mode.returnsAt
    : null;
}

export function buildMaintenanceNotice(
  mode: MaintenanceMode,
  now: Date,
): MaintenanceNotice {
  return { kind: "maintenance", returnsAt: pickReturnTime(mode, now) };
}

/** Las cabeceras que lleva toda respuesta de mantenimiento. */
export function applyMaintenanceHeaders(headers: Headers): void {
  headers.set("Retry-After", String(MAINTENANCE_RETRY_AFTER_SECONDS));
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Cache-Control", "no-store");
}
