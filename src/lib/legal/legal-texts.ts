import type { Language } from "../i18n/languages";

import { privacyEn } from "./content/privacy.en";
import { privacyEs } from "./content/privacy.es";
import { termsEn } from "./content/terms.en";
import { termsEs } from "./content/terms.es";
import type { LegalDocumentId } from "./legal-documents";
import type { LegalText } from "./legal-text-types";

// Sin respaldo entre idiomas: un texto legal en el idioma equivocado no vale.
// El tipo obliga a tener los dos idiomas de cada documento.
export const LEGAL_TEXTS = {
  terms: { es: termsEs, en: termsEn },
  privacy: { es: privacyEs, en: privacyEn },
} as const satisfies Record<LegalDocumentId, Record<Language, LegalText>>;

export function getLegalText(
  id: LegalDocumentId,
  language: Language,
): LegalText {
  const text: LegalText | undefined = LEGAL_TEXTS[id][language];
  if (text === undefined) {
    throw new Error(`El documento "${id}" no tiene texto en "${language}".`);
  }
  return text;
}
