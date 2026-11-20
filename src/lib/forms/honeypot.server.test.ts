import { describe, expect, it } from "vitest";

import { HONEYPOT_FIELD, isHoneypotFilled } from "./honeypot.server";

function buildSubmission(honeypotValue?: string): FormData {
  const formData = new FormData();
  formData.set("email", "ana@ejemplo.co");
  if (honeypotValue !== undefined) {
    formData.set(HONEYPOT_FIELD, honeypotValue);
  }
  return formData;
}

describe("campo trampa", () => {
  it("un envío con el campo vacío pasa", () => {
    expect(isHoneypotFilled(buildSubmission(""))).toBe(false);
  });

  it("un envío sin el campo pasa", () => {
    expect(isHoneypotFilled(buildSubmission())).toBe(false);
  });

  it("un envío con el campo lleno se descarta", () => {
    expect(isHoneypotFilled(buildSubmission("https://spam.test"))).toBe(true);
  });

  it("un envío con solo espacios en el campo se descarta", () => {
    expect(isHoneypotFilled(buildSubmission("   "))).toBe(true);
  });

  it("un archivo en el campo también cuenta como lleno", () => {
    const formData = buildSubmission();
    formData.set(HONEYPOT_FIELD, new Blob(["x"]), "x.txt");

    expect(isHoneypotFilled(formData)).toBe(true);
  });

  it("el nombre del campo parece un campo real y no delata la trampa", () => {
    expect(HONEYPOT_FIELD).toMatch(/^[a-z_]+$/);
    expect(HONEYPOT_FIELD).not.toMatch(/honey|trap|trampa|bot/);
  });
});
