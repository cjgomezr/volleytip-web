import { data } from "react-router";

import {
  normalizeText,
  type FieldError,
  type LocalizedDraft,
} from "../admin/site-texts";
import { SUPPORTED_LANGUAGES, type Language } from "../i18n/languages";
import type { AdminActionOutcome } from "./admin-action.server";

// Lo que comparten los formularios de "Textos del sitio".

const BAD_REQUEST = 400;
export const LANGUAGES: readonly Language[] = SUPPORTED_LANGUAGES.map(
  ({ code }) => code,
);

export function buildByLanguage<Value>(
  read: (language: Language) => Value,
): Readonly<Record<Language, Value>> {
  return Object.fromEntries(
    LANGUAGES.map((language) => [language, read(language)]),
  ) as Record<Language, Value>;
}

export function buildDraft(
  read: (language: Language) => string,
): LocalizedDraft {
  return buildByLanguage(read);
}

type Rejection<Outcome> = ReturnType<typeof data<Outcome>>;

export type SaveOutcome<Outcome, Field extends string> = AdminActionOutcome<
  Outcome | Rejection<Outcome>,
  Field
>;

export function reject<Outcome>(outcome: Outcome): {
  result: Rejection<Outcome>;
  change: null;
} {
  return { result: data(outcome, { status: BAD_REQUEST }), change: null };
}

export function findTextError(
  text: string,
  { maxLength, isRequired }: { maxLength: number; isRequired: boolean },
): FieldError | undefined {
  const normalized = normalizeText(text);
  if (isRequired && normalized === "") return "required";
  // Por caracteres y no por unidades de UTF-16: un emoji cuenta uno.
  return [...normalized].length > maxLength ? "tooLong" : undefined;
}
