import { findPanelNotFound } from "../panel/panel-not-found";
import {
  ALL_LANGUAGES,
  getServedLanguage,
  type ActiveLanguages,
} from "./active-languages";
import { findInactiveLanguageNotFound } from "./inactive-language-not-found";
import { DEFAULT_LANGUAGE, type Language } from "./languages";

export interface DocumentLanguages {
  readonly activeLanguages: ActiveLanguages;
  /** El del documento: su `lang`, sus textos y sus enlaces. */
  readonly language: Language;
  /** Presente cuando el idioma no sale de la dirección: en el 404 de un idioma
   * desactivado, también bajo la dirección del panel. */
  readonly forcedLanguage?: Language;
}

interface DocumentState {
  readonly pathname: string;
  readonly error: unknown;
  /** Los de la raíz, si llegó a cargar sus datos. */
  readonly rootLanguages: ActiveLanguages | undefined;
}

/** En qué idioma se pinta el documento y cuáles ofrece. */
export function readDocumentLanguages({
  pathname,
  error,
  rootLanguages,
}: DocumentState): DocumentLanguages {
  // Los del error van primero: al navegar a un idioma que se acaba de
  // desactivar, los datos de la raíz pueden ser los de antes.
  const inactive = findInactiveLanguageNotFound(error);
  if (inactive !== undefined) {
    return {
      activeLanguages: inactive.activeLanguages,
      language: DEFAULT_LANGUAGE,
      forcedLanguage: DEFAULT_LANGUAGE,
    };
  }
  const activeLanguages =
    findPanelNotFound(error)?.activeLanguages ?? rootLanguages ?? ALL_LANGUAGES;
  return {
    activeLanguages,
    language: getServedLanguage(pathname, activeLanguages),
  };
}
