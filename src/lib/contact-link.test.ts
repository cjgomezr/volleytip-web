import { describe, expect, it } from "vitest";

import type { PageDeclaration } from "~/lib/i18n/page-path";

import {
  CONTACT_REASON_BRANDS,
  CONTACT_REASON_PARAM,
  getContactHref,
} from "./contact-link";

const HOME: PageDeclaration = { id: "home", file: "routes/home.tsx", path: "" };
const CONTACT: PageDeclaration = {
  id: "contact",
  file: "routes/contact.tsx",
  path: { es: "contacto", en: "contact" },
};

describe("contacto: enlace con motivo", () => {
  it("lleva a Contacto con el motivo de marcas en español", () => {
    expect(getContactHref([HOME, CONTACT], "es", CONTACT_REASON_BRANDS)).toBe(
      `/contacto?${CONTACT_REASON_PARAM}=${CONTACT_REASON_BRANDS}`,
    );
  });

  it("conserva el idioma de la página", () => {
    expect(getContactHref([HOME, CONTACT], "en", CONTACT_REASON_BRANDS)).toBe(
      `/en/contact?${CONTACT_REASON_PARAM}=${CONTACT_REASON_BRANDS}`,
    );
  });

  it("devuelve undefined cuando Contacto no está en el mapa de páginas", () => {
    expect(getContactHref([HOME], "es", CONTACT_REASON_BRANDS)).toBeUndefined();
  });
});
