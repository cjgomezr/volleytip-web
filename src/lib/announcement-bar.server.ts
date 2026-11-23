import { DEFAULT_LANGUAGE, type Language } from "./i18n/languages";
import type { SettingDefinition } from "./settings.server";
import { resolveTranslatedFields } from "./translation-fallback";

export const ANNOUNCEMENT_BAR_KEY = "announcement_bar";

/** Cuántos mensajes caben en la barra; los que sobren se ignoran. */
export const MAX_ANNOUNCEMENT_MESSAGES = 3;

/** Un mensaje de la barra: su texto por idioma. El español es obligatorio. */
export interface AnnouncementMessage {
  readonly text: { readonly es: string } & Partial<Record<Language, string>>;
}

function isAnnouncementMessage(value: unknown): value is AnnouncementMessage {
  if (typeof value !== "object" || value === null || !("text" in value)) {
    return false;
  }
  const { text } = value;
  if (typeof text !== "object" || text === null) {
    return false;
  }
  const translations = Object.values(text);
  return (
    "es" in text &&
    translations.length > 0 &&
    translations.every((translation) => typeof translation === "string")
  );
}

/** La forma del ajuste `settings.announcement_bar`: una lista de mensajes.
 * Es la que va a escribir la pantalla del admin (W10a). */
export const ANNOUNCEMENT_BAR_SETTING: SettingDefinition<
  readonly AnnouncementMessage[]
> = {
  key: ANNOUNCEMENT_BAR_KEY,
  isValid: (value): value is readonly AnnouncementMessage[] =>
    Array.isArray(value) && value.every(isAnnouncementMessage),
  fallback: [],
};

/** Los textos de los primeros mensajes en el idioma de la página, con el
 * español cuando falta la traducción. */
export function pickAnnouncementMessages(
  messages: readonly AnnouncementMessage[],
  language: Language,
): string[] {
  return messages.slice(0, MAX_ANNOUNCEMENT_MESSAGES).map(
    ({ text }) =>
      resolveTranslatedFields<{ text: string }>({
        requestedLanguage: language,
        translations: {
          [DEFAULT_LANGUAGE]: { text: text.es },
          [language]: { text: text[language] },
        },
      }).fields.text,
  );
}
