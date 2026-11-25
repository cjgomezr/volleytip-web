import type { LanguageSuggestionTexts } from "~/components/language-suggestion";

import { getLanguageProposal } from "./language-choice.server";
import { getRequestLanguage, type Language } from "./languages";
import { getTranslate } from "./messages.server";

export interface LanguageSuggestionData {
  readonly proposed: Language;
  readonly pageLanguage: Language;
  readonly texts: LanguageSuggestionTexts;
}

/** Lo que pinta el aviso de idioma, o `null` si no debe salir. Los textos van
 * en el idioma que propone, no en el de la página: es el que lee quien lo
 * recibe. */
export async function loadLanguageSuggestion(
  request: Request,
): Promise<LanguageSuggestionData | null> {
  const proposed = await getLanguageProposal(request);
  if (proposed === undefined) return null;
  const translate = getTranslate(proposed);
  return {
    proposed,
    pageLanguage: getRequestLanguage(request),
    texts: {
      label: translate("languageSuggestion.label"),
      message: translate("languageSuggestion.message"),
      accept: translate("languageSuggestion.accept"),
      stay: translate("languageSuggestion.stay"),
    },
  };
}
