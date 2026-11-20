import { describe, expect, it } from "vitest";

import { hashIp } from "./ip-hash.server";

const SECRET = "secreto-de-prueba-para-derivar-la-sal-del-hash";
const OTHER_SECRET = "otro-secreto-de-prueba-distinto-del-primero-0001";
const IPV4 = "203.0.113.7";
const IPV6 = "2001:db8::1";
const NOON = Date.UTC(2026, 10, 20, 12, 0, 0);
const LAST_MILLISECOND_OF_DAY = Date.UTC(2026, 10, 20, 23, 59, 59, 999);
const FIRST_MILLISECOND_OF_NEXT_DAY = Date.UTC(2026, 10, 21, 0, 0, 0, 0);
const SHA256_HEX = /^[0-9a-f]{64}$/;

function hashAt(ip: string, instant: number, secret = SECRET): string {
  return hashIp(ip, { secret, now: () => instant });
}

describe("hash de IP", () => {
  it("la misma IP el mismo día da el mismo hash", () => {
    expect(hashAt(IPV4, NOON)).toBe(hashAt(IPV4, LAST_MILLISECOND_OF_DAY));
  });

  it("la misma IP cambia de hash al cruzar la medianoche UTC", () => {
    expect(hashAt(IPV4, LAST_MILLISECOND_OF_DAY)).not.toBe(
      hashAt(IPV4, FIRST_MILLISECOND_OF_NEXT_DAY),
    );
  });

  it("dos IPs distintas dan hashes distintos", () => {
    expect(hashAt(IPV4, NOON)).not.toBe(hashAt("203.0.113.8", NOON));
  });

  it.each([IPV4, IPV6])("para %s devuelve un SHA-256 en hexadecimal", (ip) => {
    expect(hashAt(ip, NOON)).toMatch(SHA256_HEX);
  });

  it.each([IPV4, IPV6])("para %s nunca devuelve la IP en claro", (ip) => {
    expect(hashAt(ip, NOON)).not.toContain(ip);
  });

  it("con otro secreto el hash es otro", () => {
    expect(hashAt(IPV4, NOON)).not.toBe(hashAt(IPV4, NOON, OTHER_SECRET));
  });

  it("no contiene el secreto", () => {
    expect(hashAt(IPV4, NOON)).not.toContain(SECRET);
  });
});
