import {
  buildInboxSearch,
  FIELD_LABEL_KEYS,
  MAIL_SUBJECT_KEY,
  MESSAGE_NOTICES,
  REASON_LABEL_KEYS,
  type InboxQuery,
  type InboxRowView,
  type InboxView,
  type MessageFieldView,
  type MessageNotice,
  type MessageStatus,
  type MessageView,
} from "../admin/messages";
import type { Json } from "../database.types";
import { formatDate } from "../i18n/format";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_NAMES,
  type Language,
} from "../i18n/languages";
import { getTranslate } from "../i18n/messages.server";
import { getPanelPath } from "../i18n/panel-pages";
import type { MessageReason } from "../messages.server";
import type {
  InboxPage,
  InboxRow,
  StoredMessage,
} from "./messages-inbox.server";

// De las filas de la base a lo que pintan las pantallas. Fechas y nombres de
// país salen del servidor ya en el idioma del panel.

const EXCERPT_LENGTH = 120;

/** La dirección de un mensaje en un idioma. */
export function buildMessagePath(id: string, language: Language): string {
  return getPanelPath("adminMessage", language, { messageId: id });
}

// La base solo deja guardar los motivos de la lista.
function asReason(reason: string): MessageReason {
  return reason as MessageReason;
}

function buildExcerpt(body: string): string {
  const characters = [...body.replace(/\s+/g, " ").trim()];
  const start = characters.slice(0, EXCERPT_LENGTH).join("");
  return characters.length > EXCERPT_LENGTH ? `${start}…` : start;
}

function buildRow(row: InboxRow, language: Language): InboxRowView {
  return {
    id: row.id,
    href: buildMessagePath(row.id, language),
    name: row.name,
    excerpt: buildExcerpt(row.body),
    reason: asReason(row.reason),
    status: row.status,
    dateTime: row.created_at,
    date: formatDate(new Date(row.created_at), language, {
      style: "short",
      withTime: true,
    }),
  };
}

export function buildInboxView(
  { rows, total, page, pageCount }: InboxPage,
  query: InboxQuery,
  language: Language,
): InboxView {
  const inboxPath = getPanelPath("adminMessages", language);
  const hrefOf = (target: number): string =>
    `${inboxPath}${buildInboxSearch({ ...query, page: target })}`;
  return {
    query: { ...query, page },
    rows: rows.map((row) => buildRow(row, language)),
    total,
    page,
    pageCount,
    previousHref: page > 1 ? hrefOf(page - 1) : null,
    nextHref: page < pageCount ? hrefOf(page + 1) : null,
  };
}

function formatFieldValue(value: Json): string {
  if (Array.isArray(value)) return value.map(formatFieldValue).join(", ");
  if (value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// Lo que no se reconoce también se muestra: es parte de lo que la persona
// envió.
function buildFields(payload: Json): readonly MessageFieldView[] {
  if (payload === null || typeof payload !== "object") return [];
  return Object.entries(payload).flatMap(([id, raw]) => {
    const value = formatFieldValue(raw ?? null);
    if (value === "") return [];
    const labelKey = Object.hasOwn(FIELD_LABEL_KEYS, id)
      ? FIELD_LABEL_KEYS[id]
      : undefined;
    return [labelKey ? { id, labelKey, value } : { id, value }];
  });
}

function nameCountry(code: string, language: Language): string {
  return new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code;
}

// El correo lo lee quien escribió: el asunto va en su idioma. La dirección se
// codifica entera para que no pueda agregar destinatarios ni encabezados.
function buildMailHref({ email, reason, locale }: StoredMessage): string {
  const translate = getTranslate(
    isSupportedLanguage(locale) ? locale : DEFAULT_LANGUAGE,
  );
  const subject = translate(MAIL_SUBJECT_KEY, {
    reason: translate(REASON_LABEL_KEYS[asReason(reason)]),
  });
  const address = encodeURIComponent(email).replaceAll("%40", "@");
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

function buildWhatsapp(number: string | null): MessageView["whatsapp"] {
  const digits = (number ?? "").replace(/\D/g, "");
  if (number === null || digits === "") return null;
  return { number, href: `https://wa.me/${digits}` };
}

function buildAnswer(
  { answered_at: answeredAt, answerer }: StoredMessage,
  language: Language,
): MessageView["answer"] {
  if (answeredAt === null) return null;
  return {
    by: answerer?.full_name?.trim() || answerer?.email || null,
    dateTime: answeredAt,
    date: formatDate(new Date(answeredAt), language, { withTime: true }),
  };
}

// En qué estados un aviso sigue siendo cierto.
const NOTICE_STATUSES: Record<MessageNotice, readonly MessageStatus[]> = {
  answered: ["answered"],
  archived: ["archived"],
  reopened: ["new", "answered"],
  unchanged: ["new", "answered", "archived"],
};

// Viene de la dirección: al volver atrás puede hablar de un cambio que ya se
// deshizo.
function readNotice(
  value: string | null,
  status: MessageStatus,
): MessageNotice | null {
  const asked = MESSAGE_NOTICES.find((notice) => notice === value);
  return asked && NOTICE_STATUSES[asked].includes(status) ? asked : null;
}

interface MessageViewOptions {
  readonly language: Language;
  /** El valor del aviso que trae la dirección. */
  readonly notice: string | null;
}

export function buildMessageView(
  message: StoredMessage,
  { language, notice }: MessageViewOptions,
): MessageView {
  const { locale, country_code: countryCode, created_at } = message;
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    reason: asReason(message.reason),
    status: message.status,
    country: countryCode && nameCountry(countryCode, language),
    language: isSupportedLanguage(locale) ? LANGUAGE_NAMES[locale] : locale,
    dateTime: created_at,
    date: formatDate(new Date(created_at), language, { withTime: true }),
    fields: buildFields(message.payload),
    body: message.body,
    privacyVersion: message.privacy_version,
    whatsapp: buildWhatsapp(message.whatsapp),
    mailHref: buildMailHref(message),
    answer: buildAnswer(message, language),
    notice: readNotice(notice, message.status),
  };
}
