import { describe, expect, it } from "vitest";

import {
  issueSignedTimestamp,
  verifySignedTimestamp,
} from "./signed-timestamp.server";

const SECRET = "secreto-de-prueba-para-firmar-marcas-de-tiempo";
const OTHER_SECRET = "otro-secreto-de-prueba-distinto-del-primero-0001";
const ISSUED_AT = Date.UTC(2026, 10, 20, 15, 0, 0);
const SECOND_MS = 1000;
const DAY_MS = 24 * 60 * 60 * SECOND_MS;
const FORM = "contact";

function issueAt(issuedAt: number, formId = FORM): string {
  return issueSignedTimestamp(formId, { secret: SECRET, now: () => issuedAt });
}

/** Verifica una marca emitida en ISSUED_AT cuando ya pasó `elapsedMs`. */
function verifyAfter(elapsedMs: number, token = issueAt(ISSUED_AT)): string {
  return verifySignedTimestamp(token, FORM, {
    secret: SECRET,
    now: () => ISSUED_AT + elapsedMs,
  }).status;
}

function splitToken(token: string): { issuedAt: string; signature: string } {
  const [issuedAt = "", signature = ""] = token.split(".");
  return { issuedAt, signature };
}

describe("marca de tiempo firmada", () => {
  it("emitida hace 2 segundos: demasiado rápido", () => {
    expect(verifyAfter(2 * SECOND_MS)).toBe("too_fast");
  });

  it("emitida hace un milisegundo menos de 3 segundos: demasiado rápido", () => {
    expect(verifyAfter(3 * SECOND_MS - 1)).toBe("too_fast");
  });

  it("emitida hace 3 segundos exactos: pasa", () => {
    expect(verifyAfter(3 * SECOND_MS)).toBe("ok");
  });

  it("emitida hace 4 segundos: pasa", () => {
    expect(verifyAfter(4 * SECOND_MS)).toBe("ok");
  });

  it("emitida hace 24 horas exactas: pasa", () => {
    expect(verifyAfter(DAY_MS)).toBe("ok");
  });

  it("emitida hace más de 24 horas: vencida", () => {
    expect(verifyAfter(DAY_MS + 1)).toBe("expired");
  });

  it("con fecha en el futuro: inválida", () => {
    expect(verifyAfter(-SECOND_MS)).toBe("invalid");
  });

  it("con la firma alterada: inválida", () => {
    const { issuedAt, signature } = splitToken(issueAt(ISSUED_AT));
    const lastCharacter = signature.at(-1) === "A" ? "B" : "A";
    const tampered = `${issuedAt}.${signature.slice(0, -1)}${lastCharacter}`;

    expect(verifyAfter(4 * SECOND_MS, tampered)).toBe("invalid");
  });

  // base64url tolera basura: sin esta regla, varias cadenas distintas
  // valdrían como la misma firma.
  it.each([
    [
      "con un carácter que no es base64url al final",
      (signature: string) => `${signature}=`,
    ],
    [
      "con un espacio en medio",
      (signature: string) => `${signature.slice(0, 10)} ${signature.slice(10)}`,
    ],
    ["con un carácter de más", (signature: string) => `${signature}A`],
  ])("la firma correcta %s: inválida", (_name, alter) => {
    const { issuedAt, signature } = splitToken(issueAt(ISSUED_AT));

    expect(verifyAfter(4 * SECOND_MS, `${issuedAt}.${alter(signature)}`)).toBe(
      "invalid",
    );
  });

  it("con el tiempo alterado para parecer más vieja: inválida", () => {
    const { issuedAt, signature } = splitToken(issueAt(ISSUED_AT));
    const olderIssuedAt = String(Number(issuedAt) - 10 * SECOND_MS);

    expect(verifyAfter(SECOND_MS, `${olderIssuedAt}.${signature}`)).toBe(
      "invalid",
    );
  });

  it("firmada con otro secreto: inválida", () => {
    const forged = issueSignedTimestamp(FORM, {
      secret: OTHER_SECRET,
      now: () => ISSUED_AT,
    });

    expect(verifyAfter(4 * SECOND_MS, forged)).toBe("invalid");
  });

  it("firmada para otro formulario: inválida", () => {
    const fromAnotherForm = issueAt(ISSUED_AT, "newsletter");

    expect(verifyAfter(4 * SECOND_MS, fromAnotherForm)).toBe("invalid");
  });

  it.each([
    ["ausente", undefined],
    ["nula", null],
    ["vacía", ""],
    ["solo espacios", "   "],
    ["sin firma", String(ISSUED_AT)],
    ["sin tiempo", ".abc"],
    ["con un tiempo que no es un número", "ayer.abc"],
    ["con tres partes", "1.2.3"],
  ])("%s: inválida", (_case, token) => {
    const verdict = verifySignedTimestamp(token, FORM, {
      secret: SECRET,
      now: () => ISSUED_AT + 4 * SECOND_MS,
    });

    expect(verdict.status).toBe("invalid");
  });

  it("un texto enorme se rechaza sin procesarlo", () => {
    const huge = `${String(ISSUED_AT)}.${"A".repeat(1_000_000)}`;

    expect(verifyAfter(4 * SECOND_MS, huge)).toBe("invalid");
  });

  it("un archivo en vez de texto: inválida", () => {
    const verdict = verifySignedTimestamp(new File(["x"], "x.txt"), FORM, {
      secret: SECRET,
      now: () => ISSUED_AT + 4 * SECOND_MS,
    });

    expect(verdict.status).toBe("invalid");
  });

  it("dos marcas del mismo instante y formulario son iguales", () => {
    expect(issueAt(ISSUED_AT)).toBe(issueAt(ISSUED_AT));
  });

  it("la marca no contiene el secreto", () => {
    expect(issueAt(ISSUED_AT)).not.toContain(SECRET);
  });
});
