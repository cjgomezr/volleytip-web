import { useLocation } from "react-router";

import { getLanguageFromPath, type Language } from "./languages";

/** El idioma de la página que se está pintando, también en la de error. */
export function useLanguage(): Language {
  return getLanguageFromPath(useLocation().pathname);
}
