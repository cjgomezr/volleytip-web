import { describe, expect, it } from "vitest";

import {
  CONTACT_REASONS,
  getContactReasonSlug,
  resolveContactReason,
} from "./contact-reasons";
import { CONTACT_REASON_BRANDS } from "./contact-link";

describe("contacto: motivos", () => {
  it("ofrece los cinco motivos en el orden de la página", () => {
    expect(CONTACT_REASONS.map(({ id }) => id)).toEqual([
      "order",
      "camps",
      "brands",
      "tip",
      "other",
    ]);
  });

  it("guarda 'Camps y VBall Tour' con el motivo camps", () => {
    const camps = CONTACT_REASONS.find(({ id }) => id === "camps");

    expect(camps?.storedReason).toBe("camps");
  });

  it("usa el parámetro de la dirección propio de cada idioma", () => {
    expect(getContactReasonSlug("order", "es")).toBe("pedido");
    expect(getContactReasonSlug("order", "en")).toBe("order");
    expect(getContactReasonSlug("brands", "es")).toBe("marcas");
    expect(getContactReasonSlug("brands", "en")).toBe("brands");
  });

  it("entiende el parámetro de cualquiera de los dos idiomas", () => {
    expect(resolveContactReason("pedido")).toBe("order");
    expect(resolveContactReason("order")).toBe("order");
    expect(resolveContactReason(CONTACT_REASON_BRANDS)).toBe("brands");
  });

  it("cae en 'Otro' con un motivo desconocido, vacío o ausente", () => {
    expect(resolveContactReason("pizza")).toBe("other");
    expect(resolveContactReason("")).toBe("other");
    expect(resolveContactReason(null)).toBe("other");
    expect(resolveContactReason(undefined)).toBe("other");
  });

  it("pide un campo propio solo en 'Un pedido' y en 'Marcas y colaboraciones'", () => {
    const extraFields = Object.fromEntries(
      CONTACT_REASONS.map(({ id, extraField }) => [id, extraField]),
    );

    expect(extraFields).toEqual({
      order: "orderNumber",
      camps: undefined,
      brands: "brand",
      tip: undefined,
      other: undefined,
    });
  });
});
