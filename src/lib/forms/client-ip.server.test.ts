import { describe, expect, it } from "vitest";

import { readClientIp, type ClientIpSettings } from "./client-ip.server";

const PROXY_HEADER = "X-Forwarded-For";
const ONE_HOP: ClientIpSettings = { header: PROXY_HEADER, trustedHops: 1 };
const TWO_HOPS: ClientIpSettings = { header: PROXY_HEADER, trustedHops: 2 };
const VISITOR_IP = "203.0.113.7";
const SPOOFED_IP = "198.51.100.99";
const INNER_PROXY_IP = "10.0.0.4";

function buildHeaders(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("IP del visitante", () => {
  it("con la cabecera del proxy sola, devuelve esa IP", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: VISITOR_IP }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: true, ip: VISITOR_IP });
  });

  it("no distingue mayúsculas en el nombre de la cabecera", () => {
    const result = readClientIp(
      buildHeaders({ "x-forwarded-for": VISITOR_IP }),
      {
        header: "X-FORWARDED-FOR",
        trustedHops: 1,
      },
    );

    expect(result).toEqual({ ok: true, ip: VISITOR_IP });
  });

  // El cliente manda su propia X-Forwarded-For y el proxy agrega al final la
  // IP real de la conexión. Vale la que puso el proxy.
  it("ignora la IP que el cliente falsificó en X-Forwarded-For", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: `${SPOOFED_IP}, ${VISITOR_IP}` }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: true, ip: VISITOR_IP });
  });

  it("con varias falsas delante, sigue usando la del proxy", () => {
    const result = readClientIp(
      buildHeaders({
        [PROXY_HEADER]: `${SPOOFED_IP}, 192.0.2.1, ${VISITOR_IP}`,
      }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: true, ip: VISITOR_IP });
  });

  it("con dos saltos de confianza, toma la penúltima de la cadena", () => {
    const result = readClientIp(
      buildHeaders({
        [PROXY_HEADER]: `${SPOOFED_IP}, ${VISITOR_IP}, ${INNER_PROXY_IP}`,
      }),
      TWO_HOPS,
    );

    expect(result).toEqual({ ok: true, ip: VISITOR_IP });
  });

  it("acepta una IPv6", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: "2001:db8::1" }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: true, ip: "2001:db8::1" });
  });

  it("lee otra cabecera si así se configura", () => {
    const result = readClientIp(
      buildHeaders({ "X-Real-IP": VISITOR_IP, [PROXY_HEADER]: SPOOFED_IP }),
      { header: "X-Real-IP", trustedHops: 1 },
    );

    expect(result).toEqual({ ok: true, ip: VISITOR_IP });
  });

  it("sin cabeceras devuelve un error, no una IP por defecto", () => {
    const result = readClientIp(buildHeaders({}), ONE_HOP);

    expect(result).toEqual({ ok: false, reason: "missing_header" });
  });

  it("con la cabecera vacía devuelve un error", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: "  " }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: false, reason: "missing_header" });
  });

  it("con menos entradas que saltos devuelve un error", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: VISITOR_IP }),
      TWO_HOPS,
    );

    expect(result).toEqual({ ok: false, reason: "not_enough_hops" });
  });

  it.each(["desconocida", "203.0.113.999", "203.0.113.7:4321", "<script>"])(
    "con el valor %j, que no es una IP, devuelve un error",
    (value) => {
      const result = readClientIp(
        buildHeaders({ [PROXY_HEADER]: value }),
        ONE_HOP,
      );

      expect(result).toEqual({ ok: false, reason: "not_an_ip" });
    },
  );

  it("si la entrada de confianza no es una IP, no cae a la del cliente", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: `${SPOOFED_IP}, basura` }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: false, reason: "not_an_ip" });
  });

  it("el error no trae el valor recibido", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: `${SPOOFED_IP}, basura` }),
      ONE_HOP,
    );

    expect(JSON.stringify(result)).not.toContain(SPOOFED_IP);
  });
});

describe("IP del visitante: saltos mal configurados", () => {
  // Con 0, `at(-0)` leería la primera entrada, que es la que escribe el
  // cliente. Un valor así es un error de configuración, no una IP.
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "con %s saltos lanza un error y no lee la entrada del cliente",
    (trustedHops) => {
      const headers = buildHeaders({
        [PROXY_HEADER]: `${SPOOFED_IP}, ${VISITOR_IP}`,
      });

      expect(() =>
        readClientIp(headers, { header: PROXY_HEADER, trustedHops }),
      ).toThrow("CLIENT_IP_TRUSTED_HOPS");
    },
  );

  it("el error de configuración no trae ninguna IP", () => {
    const headers = buildHeaders({
      [PROXY_HEADER]: `${SPOOFED_IP}, ${VISITOR_IP}`,
    });
    let message = "";
    try {
      readClientIp(headers, { header: PROXY_HEADER, trustedHops: 0 });
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message).not.toBe("");
    expect(message).not.toContain(SPOOFED_IP);
    expect(message).not.toContain(VISITOR_IP);
  });
});

describe("IP del visitante: una sola forma de escribirla", () => {
  // La misma persona debe dar siempre el mismo hash, escriba como escriba el
  // proxy su dirección.
  it("pasa a minúsculas una IPv6", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: "2001:DB8::AB12" }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: true, ip: "2001:db8::ab12" });
  });

  it.each(["::ffff:203.0.113.7", "::FFFF:203.0.113.7"])(
    "una IPv4 escrita como IPv6 (%s) queda como IPv4",
    (mapped) => {
      const result = readClientIp(
        buildHeaders({ [PROXY_HEADER]: mapped }),
        ONE_HOP,
      );

      expect(result).toEqual({ ok: true, ip: VISITOR_IP });
    },
  );

  it("una IPv6 con zona no es una IP utilizable", () => {
    const result = readClientIp(
      buildHeaders({ [PROXY_HEADER]: "fe80::1%eth0" }),
      ONE_HOP,
    );

    expect(result).toEqual({ ok: false, reason: "not_an_ip" });
  });
});
