import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

import type { Language } from "./languages";
import { createTranslate, type Messages, type Translate } from "./translate";

const TranslateContext = createContext<Translate | null>(null);

interface TranslationsProviderProps {
  readonly language: Language;
  readonly messages: Messages;
  readonly children: ReactNode;
}

export function TranslationsProvider({
  language,
  messages,
  children,
}: TranslationsProviderProps): ReactElement {
  const translate = useMemo(
    () => createTranslate(messages, language),
    [messages, language],
  );
  return (
    <TranslateContext.Provider value={translate}>
      {children}
    </TranslateContext.Provider>
  );
}

/** La única forma de leer un texto en un componente. */
export function useTranslate(): Translate {
  const translate = useContext(TranslateContext);
  if (translate === null) {
    throw new Error("useTranslate necesita un TranslationsProvider arriba.");
  }
  return translate;
}
