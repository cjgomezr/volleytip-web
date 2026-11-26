import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

import { ALL_LANGUAGES, type ActiveLanguages } from "./active-languages";
import type { Language } from "./languages";

interface SiteLanguages {
  readonly activeLanguages: ActiveLanguages;
  /** El idioma de la página cuando no sale de su dirección. */
  readonly forcedLanguage?: Language;
}

// Sin proveedor valen todos: así se pinta cualquier página suelta.
const SiteLanguagesContext = createContext<SiteLanguages>({
  activeLanguages: ALL_LANGUAGES,
});

export function ActiveLanguagesProvider({
  languages,
  forcedLanguage,
  children,
}: {
  readonly languages: ActiveLanguages;
  readonly forcedLanguage?: Language;
  readonly children: ReactNode;
}): ReactElement {
  const value = useMemo(
    () => ({ activeLanguages: languages, forcedLanguage }),
    [languages, forcedLanguage],
  );
  return (
    <SiteLanguagesContext.Provider value={value}>
      {children}
    </SiteLanguagesContext.Provider>
  );
}

/** Los idiomas que el sitio ofrece ahora mismo. */
export function useActiveLanguages(): ActiveLanguages {
  return useContext(SiteLanguagesContext).activeLanguages;
}

/** El idioma impuesto a la página, o `undefined` si lo dice su dirección. */
export function useForcedLanguage(): Language | undefined {
  return useContext(SiteLanguagesContext).forcedLanguage;
}
