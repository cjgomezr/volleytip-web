import type { Language } from "../i18n/languages";
import type { MessageKey } from "../i18n/translate";
import type { SiteStatId } from "../site-stats.server";

// Lo que comparten el servidor y la pantalla "Textos del sitio" (FR-065).

/** Un texto en cada idioma del sitio; vacío es que no lo tiene. */
export type LocalizedDraft = Readonly<Record<Language, string>>;

export type SiteStatPart = "value" | "label";

export interface SiteStatDraft {
  readonly id: SiteStatId;
  readonly value: LocalizedDraft;
  readonly label: LocalizedDraft;
}

export interface SiteTextsLimits {
  readonly maxMessages: number;
  readonly maxMessageLength: number;
  readonly maxStatValueLength: number;
  readonly maxStatLabelLength: number;
}

export interface SiteTextsView {
  readonly bar: {
    readonly messages: readonly LocalizedDraft[];
    /** El valor guardado, tal cual, cuando no tiene la forma esperada. */
    readonly invalidValue: string | null;
  };
  readonly stats: readonly SiteStatDraft[];
  readonly limits: SiteTextsLimits;
}

export type FieldError = "required" | "tooLong";

/** Los errores de un envío, por campo. */
export type FieldErrors = Readonly<Record<string, FieldError>>;

type Accepted = { readonly status: "saved" | "unchanged" };

export type BarOutcome =
  | Accepted
  | {
      readonly status: "invalid";
      /** Lo que se envió, para volver a pintarlo. */
      readonly values: readonly LocalizedDraft[];
      /** Por posición e idioma: ver `messageField`. */
      readonly fieldErrors: FieldErrors;
      readonly formError: "tooMany" | "malformed" | null;
    };

export type StatsOutcome =
  | Accepted
  | {
      readonly status: "invalid";
      /** Lo que se envió, por nombre de campo: ver `statField`. */
      readonly values: Readonly<Record<string, string>>;
      readonly fieldErrors: FieldErrors;
      readonly formError: "malformed" | null;
    };

/** Cuántos mensajes manda el formulario de la barra. Sin él no se distingue
 * una barra vacía de un envío incompleto. */
export const MESSAGE_COUNT_FIELD = "messageCount";

// Espacios, controles y caracteres de formato: no se ven en el sitio.
const INVISIBLE_ONLY = /^[\p{Cc}\p{Cf}\s]*$/u;

/** Dice si un texto se vería vacío. El servidor y la pantalla usan la misma
 * regla. */
export function isBlankText(text: string): boolean {
  return INVISIBLE_ONLY.test(text);
}

/**
 * Un texto de una línea como se guarda. Un salto de línea u otro carácter de
 * control no se ve en el sitio, y el nulo ni siquiera cabe en la base. Lo
 * demás, HTML incluido, queda tal cual. Los de formato solo se quitan si no
 * hay nada más: unen emojis.
 */
export function normalizeText(text: string): string {
  const cleaned = text.replace(/\p{Cc}+/gu, " ").trim();
  return isBlankText(cleaned) ? "" : cleaned;
}

/** El campo de un mensaje de la barra en los errores de un envío. */
export function messageField(position: number, language: Language): string {
  return `${position}.${language}`;
}

/** El nombre del campo de una cifra en el formulario y en la bitácora. */
export function statField(
  id: SiteStatId,
  part: SiteStatPart,
  language: Language,
): string {
  return `stats.${id}.${part}:${language}`;
}

export const SITE_STAT_NAME_KEYS: Readonly<Record<SiteStatId, MessageKey>> = {
  instagram: "panel.siteTexts.stats.instagram",
  tiktok: "panel.siteTexts.stats.tiktok",
  views: "panel.siteTexts.stats.views",
  region: "panel.siteTexts.stats.region",
};
