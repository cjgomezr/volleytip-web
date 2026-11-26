import { useLocation } from "react-router";

import { getServedLanguage } from "./active-languages";
import { useActiveLanguages } from "./active-languages-context";
import type { Language } from "./languages";

/** El idioma de la página que se está pintando, también en la de error. */
export function useLanguage(): Language {
  return getServedLanguage(useLocation().pathname, useActiveLanguages());
}
