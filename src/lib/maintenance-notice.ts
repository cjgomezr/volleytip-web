import { isRouteErrorResponse } from "react-router";

export const MAINTENANCE_STATUS = 503;

/** Lo que viaja en el 503 del modo mantenimiento hasta la página. La hora
 * de regreso ya viene decidida (futura o ausente): la página no consulta el
 * reloj, así que el servidor y el navegador pintan lo mismo. */
export interface MaintenanceNotice {
  readonly kind: "maintenance";
  readonly returnsAt: string | null;
}

function isMaintenanceNotice(value: unknown): value is MaintenanceNotice {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "maintenance" &&
    "returnsAt" in value &&
    (value.returnsAt === null || typeof value.returnsAt === "string")
  );
}

/** El error que lanza el middleware cuando el modo está encendido, o
 * `undefined` si `error` es cualquier otra cosa. */
export function findMaintenanceNotice(
  error: unknown,
): MaintenanceNotice | undefined {
  if (!isRouteErrorResponse(error) || error.status !== MAINTENANCE_STATUS) {
    return undefined;
  }
  return isMaintenanceNotice(error.data) ? error.data : undefined;
}
