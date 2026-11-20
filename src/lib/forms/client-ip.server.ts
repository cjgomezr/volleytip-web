import { isIP } from "node:net";

/**
 * IP del visitante (FR-135). El servidor no ve la conexión del visitante:
 * la ve el proxy del hosting, que la anota en una cabecera. Cuál cabecera y
 * cuántos proxies de confianza hay delante es configuración del entorno
 * (`CLIENT_IP_HEADER` y `CLIENT_IP_TRUSTED_HOPS`), no una constante.
 *
 * La IP que devuelve este módulo solo sirve para calcular su hash. No se
 * guarda ni se escribe en ningún registro.
 */

export interface ClientIpSettings {
  /** Nombre de la cabecera que pone el proxy. */
  readonly header: string;
  /**
   * Cuántos proxies de confianza anotan en la cabecera. Cada uno agrega al
   * final la IP de quien se le conectó, así que la del visitante es la
   * entrada número `trustedHops` contando desde la derecha.
   */
  readonly trustedHops: number;
}

export type ClientIpFailure =
  /** La cabecera no llegó o llegó vacía. */
  | "missing_header"
  /** La cabecera trae menos entradas que proxies de confianza. */
  | "not_enough_hops"
  /** La entrada de confianza no es una IPv4 ni una IPv6. */
  | "not_an_ip";

export type ClientIpResult =
  | { readonly ok: true; readonly ip: string }
  | { readonly ok: false; readonly reason: ClientIpFailure };

const ENTRY_SEPARATOR = ",";
const NOT_AN_IP = 0;

/**
 * Lee la IP del visitante de la cabecera configurada.
 *
 * Lo que el cliente escriba en esa cabecera queda a la izquierda de lo que
 * agregan los proxies, y nunca se lee. Si algo no cuadra devuelve un error:
 * no hay IP por defecto, porque todos los visitantes compartirían el mismo
 * límite de envíos.
 */
export function readClientIp(
  headers: Headers,
  { header, trustedHops }: ClientIpSettings,
): ClientIpResult {
  const value = headers.get(header)?.trim();
  if (value === undefined || value === "") {
    return { ok: false, reason: "missing_header" };
  }
  const entries = value.split(ENTRY_SEPARATOR).map((entry) => entry.trim());
  const candidate = entries.at(-trustedHops);
  if (candidate === undefined) {
    return { ok: false, reason: "not_enough_hops" };
  }
  if (isIP(candidate) === NOT_AN_IP) {
    return { ok: false, reason: "not_an_ip" };
  }
  return { ok: true, ip: candidate };
}
