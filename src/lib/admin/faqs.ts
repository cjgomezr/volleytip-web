import type { Database } from "../database.types";
import type { MessageKey } from "../i18n/translate";

// Lo que comparten el servidor y las pantallas de "Preguntas frecuentes"
// (FR-065, FR-137).

export type FaqStatus = Database["public"]["Enums"]["publish_status"];

export const MAX_FAQ_QUESTION_LENGTH = 200;
export const MAX_FAQ_ANSWER_LENGTH = 2000;

/** La pregunta y la respuesta en un idioma; vacías es que no lo tiene. */
export interface FaqText {
  readonly question: string;
  readonly answer: string;
}

export type FaqPart = keyof FaqText;

/** Un idioma activo y si la pregunta tiene su traducción completa. */
export interface FaqLanguage {
  readonly code: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly isTranslated: boolean;
}

export interface FaqRowView {
  readonly id: string;
  readonly status: FaqStatus;
  /** En el idioma por defecto o, sin él, en el que tenga. */
  readonly question: string;
  readonly questionLanguage: string;
  /** Los nombres van en el idioma del panel. */
  readonly languages: readonly FaqLanguage[];
}

export interface FaqListView {
  /** En el orden en que salen en el sitio. */
  readonly rows: readonly FaqRowView[];
  /** La pregunta que se acaba de crear, si hay que avisarlo. */
  readonly createdId: string | null;
}

export interface FaqEditorView {
  /** `null` al crear una pregunta. */
  readonly faqId: string | null;
  readonly status: FaqStatus | null;
  /** Cada nombre va escrito en su propio idioma. */
  readonly languages: readonly FaqLanguage[];
  /** Lo guardado, por código de idioma. */
  readonly texts: Readonly<Record<string, FaqText>>;
  readonly limits: Readonly<Record<FaqPart, number>>;
}

export type FaqFieldError = "required" | "tooLong";

export type FaqFormError = "noLanguage" | "publishedNeedsDefault" | "malformed";

export type FaqSaveOutcome =
  | { readonly status: "saved" | "unchanged" }
  | {
      readonly status: "invalid";
      /** Lo que se envió, por nombre de campo: ver `faqField`. */
      readonly values: Readonly<Record<string, string>>;
      readonly fieldErrors: Readonly<Record<string, FaqFieldError>>;
      readonly formError: FaqFormError | null;
    };

export type FaqDirection = "up" | "down";

/** Cómo terminó un botón de la lista. */
export type FaqListOutcome =
  | {
      readonly status: "published" | "retired" | "unchanged";
      readonly faqId: string;
    }
  | {
      readonly status: "moved";
      readonly faqId: string;
      readonly direction: FaqDirection;
      /** Donde quedó, desde 1. */
      readonly position: number;
    }
  | {
      readonly status: "invalid";
      readonly faqId: string;
      readonly error: "missingDefaultText" | "malformed";
    };

export type FaqListError = Extract<
  FaqListOutcome,
  { status: "invalid" }
>["error"];

export const FAQ_LIST_ERROR_KEYS: Readonly<Record<FaqListError, MessageKey>> = {
  missingDefaultText: "panel.faqs.error.missingDefaultText",
  malformed: "panel.faqs.error.malformed",
};

export const FAQ_FORM_ERROR_KEYS: Readonly<Record<FaqFormError, MessageKey>> = {
  noLanguage: "panel.faqs.error.noLanguage",
  publishedNeedsDefault: "panel.faqs.error.publishedNeedsDefault",
  malformed: "panel.faqs.error.malformed",
};

/** La dirección lleva el id de la pregunta recién creada. */
export const CREATED_PARAM = "creada";

export const DIRECTION_FIELD = "direction";

/** El nombre de un campo en el formulario y en los errores: `answer:en`. */
export function faqField(part: FaqPart, code: string): string {
  return `${part}:${code}`;
}

export const FAQ_STATUS_LABEL_KEYS: Readonly<Record<FaqStatus, MessageKey>> = {
  draft: "panel.faqs.status.draft",
  published: "panel.faqs.status.published",
  retired: "panel.faqs.status.retired",
};
