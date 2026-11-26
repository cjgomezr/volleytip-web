import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";

import { ALL_LANGUAGES, type ActiveLanguages } from "./active-languages";

// Sin proveedor valen todos: así se pinta cualquier página suelta.
const ActiveLanguagesContext = createContext<ActiveLanguages>(ALL_LANGUAGES);

export function ActiveLanguagesProvider({
  languages,
  children,
}: {
  readonly languages: ActiveLanguages;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <ActiveLanguagesContext.Provider value={languages}>
      {children}
    </ActiveLanguagesContext.Provider>
  );
}

/** Los idiomas que el sitio ofrece ahora mismo. */
export function useActiveLanguages(): ActiveLanguages {
  return useContext(ActiveLanguagesContext);
}
