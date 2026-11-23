import type { Language } from "../i18n/languages";

export type LegalDocumentStatus = "provisional" | "final";

export interface LegalDocument {
  /** Lo que se guarda junto a cada consentimiento (FR-057). */
  readonly version: string;
  /** `AAAA-MM-DD`: desde cuándo rige. */
  readonly effectiveDate: string;
  readonly status: LegalDocumentStatus;
  /** SHA-256 del texto de cada idioma. Una prueba la compara con el texto:
   * si el texto cambia y esto no, hay que subir la versión. */
  readonly fingerprints: Readonly<Record<Language, string>>;
}

// El único lugar donde se declaran la versión y la fecha de cada documento.
// Para publicar el texto definitivo: subir `version`, poner `status: "final"`,
// la fecha de vigencia y las huellas nuevas.
export const LEGAL_DOCUMENTS = {
  terms: {
    version: "borrador-1",
    effectiveDate: "2026-11-23",
    status: "provisional",
    fingerprints: {
      es: "32284062d6a34081488a952386c87181d98daacb8f88ea741a45e6236cf9aacb",
      en: "3b2aa4c464336cd1b8583953e85a8114220cf8fff55b26e4b1603a29e00994e3",
    },
  },
  privacy: {
    version: "borrador-1",
    effectiveDate: "2026-11-23",
    status: "provisional",
    fingerprints: {
      es: "7ba52c08a4aa99954fdf80eaf840d3d0783623184d97e037e3f5aa136f7096f7",
      en: "7db11635b4d508744792ffd594d3c5de83d3fc29c7d457e5dea79c0c6a164f8f",
    },
  },
} as const satisfies Record<string, LegalDocument>;

export type LegalDocumentId = keyof typeof LEGAL_DOCUMENTS;

function findDocument(id: LegalDocumentId): LegalDocument {
  const document: LegalDocument | undefined = LEGAL_DOCUMENTS[id];
  if (document === undefined) {
    throw new Error(`El documento legal "${id}" no existe.`);
  }
  return document;
}

/** La versión vigente de un documento: la que se guarda con el consentimiento. */
export function getCurrentLegalVersion(id: LegalDocumentId): string {
  return findDocument(id).version;
}

export function isProvisional(id: LegalDocumentId): boolean {
  return findDocument(id).status === "provisional";
}
