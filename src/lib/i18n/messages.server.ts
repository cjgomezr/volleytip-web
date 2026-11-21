import { en } from "./messages/en";
import { es } from "./messages/es";
import type { Language } from "./languages";
import { createTranslate, type Messages, type Translate } from "./translate";

const MESSAGES_BY_LANGUAGE: Readonly<Record<Language, Messages>> = { es, en };

/** Los textos de un idioma. Es lo único que se envía al navegador. */
export function getMessages(language: Language): Messages {
  return MESSAGES_BY_LANGUAGE[language];
}

/** Para el servidor, con o sin petición delante (un correo, por ejemplo). */
export function getTranslate(language: Language): Translate {
  return createTranslate(getMessages(language), language);
}
