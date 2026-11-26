import { isDeepStrictEqual } from "node:util";

import {
  MESSAGE_COUNT_FIELD,
  messageField,
  type BarOutcome,
  type FieldErrors,
  type LocalizedDraft,
  type SiteTextsView,
} from "../admin/site-texts";
import {
  ANNOUNCEMENT_BAR_SETTING,
  MAX_ANNOUNCEMENT_LENGTH,
  MAX_ANNOUNCEMENT_MESSAGES,
  type AnnouncementMessage,
} from "../announcement-bar.server";
import type { Json } from "../database.types";
import { DEFAULT_LANGUAGE } from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import {
  buildByLanguage,
  buildDraft,
  findTextError,
  LANGUAGES,
  normalizeText,
  reject,
  type SaveOutcome,
} from "./editor-input.server";
import {
  readStoredSetting,
  replaceSetting,
  type StoredSetting,
} from "./stored-setting.server";

function toDraft({ text }: AnnouncementMessage): LocalizedDraft {
  return buildDraft((language) => text[language] ?? "");
}

/** El mensaje como se guarda: sin los idiomas que quedaron vacíos. */
function toStoredMessage(draft: LocalizedDraft): {
  text: Record<string, string>;
} {
  const texts = LANGUAGES.map(
    (language) => [language, normalizeText(draft[language])] as const,
  ).filter(([, text]) => text !== "");
  return { text: Object.fromEntries(texts) };
}

// De un valor mal guardado se rescatan los mensajes que sí tienen la forma.
function salvageMessages(value: unknown): readonly LocalizedDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const single: unknown = [item];
    return ANNOUNCEMENT_BAR_SETTING.isValid(single) ? single.map(toDraft) : [];
  });
}

export function describeStoredBar(
  stored: StoredSetting<readonly AnnouncementMessage[]>,
): SiteTextsView["bar"] {
  if (stored.kind === "missing") return { messages: [], invalidValue: null };
  if (stored.kind === "valid") {
    return { messages: stored.value.map(toDraft), invalidValue: null };
  }
  return {
    messages: salvageMessages(stored.raw),
    invalidValue: JSON.stringify(stored.raw, null, 2),
  };
}

/** Los mensajes del envío, en su orden; `null` si no llegó completo: sin
 * decir cuántos son, o sin un texto por idioma para cada uno. */
function readSubmittedMessages(
  formData: FormData,
): readonly LocalizedDraft[] | null {
  const declared = formData.get(MESSAGE_COUNT_FIELD);
  // Un campo por idioma (`es`, `en`), repetido una vez por mensaje.
  const columns = buildByLanguage((language) => formData.getAll(language));
  const count = columns[DEFAULT_LANGUAGE].length;
  const isComplete =
    declared === String(count) &&
    LANGUAGES.every(
      (language) =>
        columns[language].length === count &&
        columns[language].every((value) => typeof value === "string"),
    );
  if (!isComplete) return null;
  return Array.from({ length: count }, (_, position) =>
    buildDraft((language) => String(columns[language][position])),
  );
}

function findMessageErrors(messages: readonly LocalizedDraft[]): FieldErrors {
  const errors = messages.flatMap((message, position) =>
    LANGUAGES.flatMap((language) => {
      const error = findTextError(message[language], {
        maxLength: MAX_ANNOUNCEMENT_LENGTH,
        isRequired: language === DEFAULT_LANGUAGE,
      });
      return error ? [[messageField(position, language), error] as const] : [];
    }),
  );
  return Object.fromEntries(errors);
}

// Sin la fila, la barra ya está vacía. Lo guardado se compara normalizado: un
// espacio de más o un idioma vacío escritos por SQL no son un cambio de quien
// guarda.
function isSameBar(
  stored: StoredSetting<readonly AnnouncementMessage[]>,
  next: readonly Json[],
): boolean {
  if (stored.kind === "invalid") return false;
  const current = stored.kind === "valid" ? stored.value : [];
  return isDeepStrictEqual(
    current.map((message) => toStoredMessage(toDraft(message))),
    next,
  );
}

/** Valida y guarda la barra de anuncios con el cliente de la sesión. */
export async function saveAnnouncementBar(
  client: TypedSupabaseClient,
  formData: FormData,
): Promise<SaveOutcome<BarOutcome, "value">> {
  const messages = readSubmittedMessages(formData);
  if (messages === null) {
    return reject<BarOutcome>({
      status: "invalid",
      values: [],
      fieldErrors: {},
      formError: "malformed",
    });
  }
  const fieldErrors = findMessageErrors(messages);
  const hasTooMany = messages.length > MAX_ANNOUNCEMENT_MESSAGES;
  if (hasTooMany || Object.keys(fieldErrors).length > 0) {
    return reject<BarOutcome>({
      status: "invalid",
      values: messages,
      fieldErrors,
      formError: hasTooMany ? "tooMany" : null,
    });
  }
  const previous = await readStoredSetting(ANNOUNCEMENT_BAR_SETTING, client);
  const next = messages.map(toStoredMessage);
  const change = isSameBar(previous, next)
    ? null
    : await replaceSetting({
        client,
        key: ANNOUNCEMENT_BAR_SETTING.key,
        previous,
        value: next,
      });
  return {
    result: { status: change === null ? "unchanged" : "saved" },
    change,
  };
}
