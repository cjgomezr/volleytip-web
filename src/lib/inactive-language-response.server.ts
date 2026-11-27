import { data } from "react-router";

import {
  pickAnnouncementMessages,
  type AnnouncementMessage,
} from "./announcement-bar.server";
import type { ActiveLanguages } from "./i18n/active-languages";
import { getSiteYear } from "./i18n/format";
import {
  buildInactiveLanguageData,
  type InactiveLanguageNotFound,
} from "./i18n/inactive-language-not-found";
import { DEFAULT_LANGUAGE } from "./i18n/languages";
import { getMessages } from "./i18n/messages.server";

const NOT_FOUND_STATUS = 404;

/** El 404 de una dirección en un idioma desactivado, en el idioma por defecto.
 * Lo lanzan el middleware de la raíz y el panel: son el mismo, así que desde
 * fuera no se distinguen (AC-033). */
export function buildInactiveLanguageNotFound(
  activeLanguages: ActiveLanguages,
  announcements: readonly AnnouncementMessage[],
): ReturnType<typeof data<InactiveLanguageNotFound>> {
  return data(
    buildInactiveLanguageData({
      activeLanguages,
      messages: getMessages(DEFAULT_LANGUAGE),
      year: getSiteYear(new Date()),
      announcements: pickAnnouncementMessages(announcements, DEFAULT_LANGUAGE),
    }),
    { status: NOT_FOUND_STATUS },
  );
}
