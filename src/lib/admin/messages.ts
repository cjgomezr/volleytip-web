import type { MessageKey } from "../i18n/translate";
import type { MessageReason } from "../messages.server";

// La bandeja de mensajes del panel (FR-064, sin el envío): los filtros que
// viven en la dirección y lo que sus pantallas pintan. Llega al navegador: no
// importa nada de `.server` salvo tipos.

export type MessageStatus = "new" | "answered" | "archived";

// Los nombres de los parámetros son los mismos en los dos idiomas: la tarjeta
// del resumen enlaza `?estado=new`.
export const REASON_PARAM = "motivo";
export const STATUS_PARAM = "estado";
export const SEARCH_PARAM = "q";
export const PAGE_PARAM = "pagina";
/** Con qué aviso se abre el detalle después de un cambio de estado. */
export const NOTICE_PARAM = "saved";

/** El largo máximo de un correo (RFC 5321): nada de lo que se busca es más
 * largo. */
export const MAX_SEARCH_LENGTH = 254;

/** El asunto del correo con que se responde, con el nombre del motivo. */
export const MAIL_SUBJECT_KEY =
  "panel.messages.mail.subject" satisfies MessageKey;

export const REASON_LABEL_KEYS: Readonly<Record<MessageReason, MessageKey>> = {
  order: "panel.messages.reason.order",
  camps: "panel.messages.reason.camps",
  brands: "panel.messages.reason.brands",
  suggest_tip: "panel.messages.reason.suggestTip",
  vball_tour: "panel.messages.reason.vballTour",
  other: "panel.messages.reason.other",
};

export const STATUS_LABEL_KEYS: Readonly<Record<MessageStatus, MessageKey>> = {
  new: "panel.messages.status.new",
  answered: "panel.messages.status.answered",
  archived: "panel.messages.status.archived",
};

/** Los campos propios de un motivo que el panel sabe nombrar. */
export const FIELD_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  orderNumber: "panel.messages.field.orderNumber",
  brand: "panel.messages.field.brand",
  club: "panel.messages.field.club",
  organization: "panel.messages.field.organization",
};

export const MESSAGE_NOTICES = [
  "answered",
  "archived",
  "reopened",
  "unchanged",
] as const;

export type MessageNotice = (typeof MESSAGE_NOTICES)[number];

export interface InboxQuery {
  /** Nulo: todos los motivos. */
  readonly reason: MessageReason | null;
  /** Nulo: todos los estados. */
  readonly status: MessageStatus | null;
  /** Parte del nombre o del correo. Vacía: no busca. */
  readonly search: string;
  /** Desde 1. */
  readonly page: number;
}

function readKnown<Value extends string>(
  value: string | null,
  labels: Readonly<Record<Value, unknown>>,
): Value | null {
  return value !== null && Object.hasOwn(labels, value)
    ? (value as Value)
    : null;
}

// Un carácter de control no se escribe en un buscador, y el nulo ni siquiera
// cabe en la base.
function cleanSearch(value: string): string {
  return value
    .replace(/\p{Cc}+/gu, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

function readPage(value: string | null): number {
  const page = /^\d+$/.test(value ?? "") ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Los filtros de la dirección. Un valor que no se entiende se ignora. */
export function parseInboxQuery(params: URLSearchParams): InboxQuery {
  return {
    reason: readKnown(params.get(REASON_PARAM), REASON_LABEL_KEYS),
    status: readKnown(params.get(STATUS_PARAM), STATUS_LABEL_KEYS),
    search: cleanSearch(params.get(SEARCH_PARAM) ?? ""),
    page: readPage(params.get(PAGE_PARAM)),
  };
}

/** La búsqueda de la dirección (`?motivo=order&pagina=2`), o vacía. */
export function buildInboxSearch({
  reason,
  status,
  search,
  page,
}: InboxQuery): string {
  const entries = [
    [REASON_PARAM, reason ?? ""],
    [STATUS_PARAM, status ?? ""],
    [SEARCH_PARAM, search],
    [PAGE_PARAM, page > 1 ? String(page) : ""],
  ].filter(([, value]) => value !== "");
  const text = new URLSearchParams(entries).toString();
  return text === "" ? "" : `?${text}`;
}

export function hasInboxFilters({
  reason,
  status,
  search,
}: InboxQuery): boolean {
  return reason !== null || status !== null || search !== "";
}

export interface InboxRowView {
  readonly id: string;
  readonly href: string;
  readonly name: string;
  /** El comienzo del mensaje, en una línea. */
  readonly excerpt: string;
  readonly reason: MessageReason;
  readonly status: MessageStatus;
  /** La fecha para `<time>`. */
  readonly dateTime: string;
  readonly date: string;
}

export interface InboxView {
  readonly query: InboxQuery;
  readonly rows: readonly InboxRowView[];
  /** Cuántos mensajes cumplen los filtros, en todas las páginas. */
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly previousHref: string | null;
  readonly nextHref: string | null;
}

export interface MessageFieldView {
  readonly id: string;
  /** Ausente si el panel no conoce el campo: se muestra su id. */
  readonly labelKey?: MessageKey;
  readonly value: string;
}

export interface MessageView {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly reason: MessageReason;
  readonly status: MessageStatus;
  readonly country: string | null;
  /** El idioma en que escribió, con su nombre en ese idioma. */
  readonly language: string;
  readonly dateTime: string;
  readonly date: string;
  readonly fields: readonly MessageFieldView[];
  /** Texto de una persona: se pinta como texto, nunca como HTML. */
  readonly body: string;
  readonly privacyVersion: string;
  readonly whatsapp: {
    readonly number: string;
    readonly href: string;
  } | null;
  readonly mailHref: string;
  /** Presente si alguien lo respondió, también si después se archivó. */
  readonly answer: {
    /** Nulo si no se sabe quién. */
    readonly by: string | null;
    readonly dateTime: string;
    readonly date: string;
  } | null;
  readonly notice: MessageNotice | null;
}
