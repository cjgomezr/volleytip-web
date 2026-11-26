import { data } from "react-router";

import type { FieldError, LocalizedDraft } from "../admin/site-texts";
import { SUPPORTED_LANGUAGES, type Language } from "../i18n/languages";
import type { AdminActionOutcome } from "./admin-action.server";

// Lo que comparten los formularios de "Textos del sitio".

const BAD_REQUEST = 400;
export const LANGUAGES: readonly Language[] = SUPPORTED_LANGUAGES.map(
  ({ code }) => code,
);
// Un salto de línea u otro carácter de control no se ve en el sitio, y el
// nulo ni siquiera cabe en la base. Lo demás, HTML incluido, queda tal cual.
export function normalizeText(text: string): string {
  return text.replace(/\p{Cc}+/gu, " ").trim();
}

export function buildDraft(
  read: (language: Language) => string,
): LocalizedDraft {
  return Object.fromEntries(
    LANGUAGES.map((language) => [language, read(language)]),
  ) as LocalizedDraft;
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
  return normalized.length > maxLength ? "tooLong" : undefined;
}
