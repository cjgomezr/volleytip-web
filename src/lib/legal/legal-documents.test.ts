import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "../i18n/languages";

import {
  LEGAL_DOCUMENTS,
  getCurrentLegalVersion,
  isProvisional,
  type LegalDocumentId,
} from "./legal-documents";
import { LEGAL_TEXTS, getLegalText } from "./legal-texts";

const DOCUMENT_IDS = Object.keys(LEGAL_DOCUMENTS) as LegalDocumentId[];
const CONTENT_FOLDER = path.join(__dirname, "content");

function fingerprintOf(id: LegalDocumentId, language: "es" | "en"): string {
  return createHash("sha256")
    .update(JSON.stringify(getLegalText(id, language)))
    .digest("hex");
}

describe("documentos legales", () => {
  it("lists Terms and Privacy", () => {
    expect(DOCUMENT_IDS.sort()).toEqual(["privacy", "terms"]);
  });

  it.each(DOCUMENT_IDS)("gives %s a version, a date and a status", (id) => {
    const document = LEGAL_DOCUMENTS[id];

    expect(document.version).not.toBe("");
    expect(document.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(["provisional", "final"]).toContain(document.status);
  });

  it("starts both documents as provisional, as decision 4 of the PRD says", () => {
    expect(DOCUMENT_IDS.map((id) => LEGAL_DOCUMENTS[id].version)).toEqual(
      DOCUMENT_IDS.map(() => "borrador-1"),
    );
    expect(DOCUMENT_IDS.every((id) => isProvisional(id))).toBe(true);
  });
});

describe("versión vigente", () => {
  it("returns the declared version", () => {
    expect(getCurrentLegalVersion("terms")).toBe(LEGAL_DOCUMENTS.terms.version);
    expect(getCurrentLegalVersion("privacy")).toBe(
      LEGAL_DOCUMENTS.privacy.version,
    );
  });

  it("throws on an unknown document", () => {
    expect(() => getCurrentLegalVersion("shipping" as LegalDocumentId)).toThrow(
      /shipping/,
    );
  });
});

describe("archivos de los documentos", () => {
  const cases = DOCUMENT_IDS.flatMap((id) =>
    SUPPORTED_LANGUAGES.map(({ code }) => ({ id, code })),
  );

  it.each(cases)("has a file for $id in $code", ({ id, code }) => {
    const file = path.join(CONTENT_FOLDER, `${id}.${code}.ts`);

    expect(existsSync(file), `falta el archivo ${file}`).toBe(true);
  });

  it.each(cases)(
    "has a text for $id in $code with a title and a body",
    ({ id, code }) => {
      const text = LEGAL_TEXTS[id][code];

      expect(text.title.trim()).not.toBe("");
      expect(text.description.trim()).not.toBe("");
      expect(text.blocks.length).toBeGreaterThan(0);
    },
  );

  it("throws, without a fallback, when a language has no text", () => {
    expect(() => getLegalText("terms", "fr" as "es")).toThrow(/terms/);
  });
});

describe("la versión sigue al texto", () => {
  it.each(DOCUMENT_IDS)(
    "keeps the stored fingerprint of %s equal to its text: if you changed the text, raise the version and update the fingerprint",
    (id) => {
      for (const { code } of SUPPORTED_LANGUAGES) {
        expect(
          fingerprintOf(id, code),
          `El texto de "${id}" en "${code}" cambió: sube su versión en legal-documents.ts y actualiza su huella.`,
        ).toBe(LEGAL_DOCUMENTS[id].fingerprints[code]);
      }
    },
  );
});
