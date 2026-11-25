import type { MaintenanceSettingsState } from "../admin/settings-view";
import type { MaintenanceMode } from "../maintenance-mode.server";
import type { StoredSetting } from "./stored-setting.server";

/** El estado que pinta el panel. Sin fila, el modo está apagado. */
export function describeMaintenance(
  stored: StoredSetting<MaintenanceMode>,
): MaintenanceSettingsState {
  if (stored.kind === "invalid") return "invalid";
  return stored.kind === "valid" && stored.value.enabled ? "on" : "off";
}

/**
 * El valor que se guarda al encender o apagar. La hora de regreso pertenece a
 * un mantenimiento: al encender se conserva la que alguien haya puesto en la
 * base y al apagar se descarta, para que no reaparezca en el siguiente.
 */
export function buildMaintenanceValue(
  stored: StoredSetting<MaintenanceMode>,
  enabled: boolean,
): { enabled: boolean; returnsAt?: string } {
  const returnsAt =
    stored.kind === "valid" ? stored.value.returnsAt : undefined;
  return enabled && returnsAt !== undefined
    ? { enabled, returnsAt }
    : { enabled };
}
