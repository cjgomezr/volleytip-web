import { isDeepStrictEqual } from "node:util";

import {
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
import { DEFAULT_LANGUAGE, type Language } from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import {
  buildDraft,
  findTextError,
  LANGUAGES,
  normalizeText,
  reject,
  type SaveOutcome,
} from "./editor-input.server";

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

export async function readStoredBar(
  client: TypedSupabaseClient,
): Promise<Json | undefined> {
  const { data: row, error } = await client
    .from("settings")
    .select("value")
    .eq("key", ANNOUNCEMENT_BAR_SETTING.key)
    .maybeSingle();
  if (error !== null) {
    throw new Error(`No se pudo leer la barra: ${error.message}`, {
      cause: error,
    });
  }
  return row === null ? undefined : row.value;
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
  stored: Json | undefined,
): SiteTextsView["bar"] {
  const value: Json = stored === undefined ? [] : stored;
  if (ANNOUNCEMENT_BAR_SETTING.isValid(value)) {
    return { messages: value.map(toDraft), invalidValue: null };
  }
  return {
    messages: salvageMessages(value),
    invalidValue: JSON.stringify(value, null, 2),
  };
}

/** Los mensajes del envío, en su orden; `null` si los idiomas no cuadran. */
function readSubmittedMessages(
  formData: FormData,
): readonly LocalizedDraft[] | null {
  const columns = buildColumns(formData);
  const count = columns[DEFAULT_LANGUAGE].length;
  if (LANGUAGES.some((language) => columns[language].length !== count)) {
    return null;
  }
  return Array.from({ length: count }, (_, position) =>
    buildDraft((language) => columns[language][position] ?? ""),
  );
}

// Un campo por idioma (`es`, `en`), repetido una vez por mensaje.
function buildColumns(
  formData: FormData,
): Readonly<Record<Language, readonly string[]>> {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      formData.getAll(language).filter((value) => typeof value === "string"),
    ]),
  ) as unknown as Record<Language, string[]>;
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

// Lo guardado se compara ya normalizado: un espacio de más o un idioma vacío
// escritos por SQL no son un cambio de quien guarda.
function isSameBar(stored: Json, next: readonly Json[]): boolean {
  return (
    ANNOUNCEMENT_BAR_SETTING.isValid(stored) &&
    isDeepStrictEqual(
      stored.map((message) => toStoredMessage(toDraft(message))),
      next,
    )
  );
}

async function writeBar(
  client: TypedSupabaseClient,
  value: NonNullable<Json>,
): Promise<void> {
  const { error } = await client
    .from("settings")
    .upsert(
      { key: ANNOUNCEMENT_BAR_SETTING.key, value },
      { onConflict: "key" },
    );
  if (error !== null) {
    throw new Error(`No se pudo guardar la barra: ${error.message}`, {
      cause: error,
    });
  }
}

/** Valida y guarda la barra de anuncios con el cliente de la sesión. */
export async function saveAnnouncementBar(
  client: TypedSupabaseClient,
  formData: FormData,
): Promise<SaveOutcome<BarOutcome, "messages">> {
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
  // Sin la fila, la barra está vacía. Un `null` guardado es un valor inválido.
  const found = await readStoredBar(client);
  const stored: Json = found === undefined ? [] : found;
  const next = messages.map(toStoredMessage);
  if (isSameBar(stored, next)) {
    return { result: { status: "unchanged" }, change: null };
  }
  await writeBar(client, next);
  return {
    result: { status: "saved" },
    change: {
      entityId: null,
      entityKey: ANNOUNCEMENT_BAR_SETTING.key,
      before: { messages: stored },
      after: { messages: next },
    },
  };
}
