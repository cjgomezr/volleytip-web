import { createHmac } from "node:crypto";

/**
 * Hash de la IP (FR-135). El límite de envíos se cuenta por IP, pero la IP
 * no se guarda: se guarda este hash. La sal cambia cada día (UTC), así que
 * el hash de hoy no sirve para reconocer al mismo visitante mañana.
 */

// Separa esta sal de cualquier otro uso del mismo secreto.
const SALT_CONTEXT = "ip-hash-salt";
// Largo de "2026-11-20" al principio de una fecha ISO.
const ISO_DATE_LENGTH = 10;

export interface IpHashOptions {
  /** `FORM_PROTECTION_SECRET` del entorno. */
  readonly secret: string;
  /** Reloj en milisegundos. Se inyecta para poder probar el cambio de día. */
  readonly now: () => number;
}

/** La sal del día sale del secreto y de la fecha UTC. No se guarda en la
 * base: se vuelve a calcular cada vez. */
function deriveDailySalt(secret: string, instant: number): Buffer {
  const utcDate = new Date(instant).toISOString().slice(0, ISO_DATE_LENGTH);
  return createHmac("sha256", secret)
    .update(`${SALT_CONTEXT}:${utcDate}`)
    .digest();
}

/**
 * Devuelve el hash de la IP para el día en curso, en hexadecimal. La misma
 * IP da el mismo hash durante el día UTC y otro distinto al día siguiente.
 */
export function hashIp(ip: string, { secret, now }: IpHashOptions): string {
  return createHmac("sha256", deriveDailySalt(secret, now()))
    .update(ip)
    .digest("hex");
}
