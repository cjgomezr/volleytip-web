import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import {
  REASON_LABEL_KEYS,
  type MessageNotice,
  type MessageView,
} from "~/lib/admin/messages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { getButtonLinkClassName } from "../../button";
import { PanelHeading } from "../panel-heading";
import { MessageActions } from "./message-actions";
import { ReasonBadge, StatusBadge } from "./message-badges";
import {
  CARD_STYLES,
  CARD_TITLE_STYLES,
  TEXT_LINK_STYLES,
} from "./message-styles";

/** Desde este largo el nombre se pinta más pequeño para no partirse. */
const LONG_NAME_LENGTH = 20;

const NOTICE_KEYS: Record<MessageNotice, MessageKey> = {
  answered: "panel.messages.notice.answered",
  archived: "panel.messages.notice.archived",
  reopened: "panel.messages.notice.reopened",
  unchanged: "panel.messages.notice.unchanged",
};

function Card({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className={CARD_STYLES}>
      <h2 className={CARD_TITLE_STYLES}>{title}</h2>
      {children}
    </section>
  );
}

function BodyCard({ reason, body }: MessageView): ReactElement {
  const translate = useTranslate();
  return (
    <Card title={translate("panel.messages.detail.body")}>
      <p className="mt-3 mb-0">
        <ReasonBadge reason={reason} />
      </p>
      {/* Texto de una persona: va como texto, con sus saltos de línea. */}
      <p
        data-message-body
        className="mt-4 mb-0 text-[16px] leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        {body}
      </p>
    </Card>
  );
}

function Detail({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] leading-[1.4] text-ink-subtle">{label}</dt>
      <dd className="m-0 text-[15px] leading-[1.5] font-bold [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

function DataCard(message: MessageView): ReactElement {
  const translate = useTranslate();
  return (
    <Card title={translate("panel.messages.detail.data")}>
      <dl className="mt-4 mb-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Detail label={translate("panel.messages.detail.email")}>
          {message.email}
        </Detail>
        {message.whatsapp === null ? null : (
          <Detail label={translate("panel.messages.detail.whatsapp")}>
            {message.whatsapp.number}
          </Detail>
        )}
        <Detail label={translate("panel.messages.detail.reason")}>
          {translate(REASON_LABEL_KEYS[message.reason])}
        </Detail>
        {message.fields.map(({ id, labelKey, value }) => (
          <Detail key={id} label={labelKey ? translate(labelKey) : id}>
            {value}
          </Detail>
        ))}
        <Detail label={translate("panel.messages.detail.country")}>
          {message.country ?? translate("panel.messages.detail.noCountry")}
        </Detail>
        <Detail label={translate("panel.messages.detail.language")}>
          {message.language}
        </Detail>
        <Detail label={translate("panel.messages.detail.date")}>
          <time dateTime={message.dateTime}>{message.date}</time>
        </Detail>
        <Detail label={translate("panel.messages.detail.privacy")}>
          {message.privacyVersion}
        </Detail>
      </dl>
    </Card>
  );
}

function ReplyCard({ mailHref, whatsapp }: MessageView): ReactElement {
  const translate = useTranslate();
  return (
    <Card title={translate("panel.messages.detail.reply")}>
      <div className="mt-4 flex flex-col gap-3">
        <a
          href={mailHref}
          className={getButtonLinkClassName("primary", "light")}
        >
          {translate("panel.messages.detail.mail")}
        </a>
        {whatsapp === null ? null : (
          <a
            href={whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className={getButtonLinkClassName("secondary", "light")}
          >
            {translate("panel.messages.detail.writeWhatsapp")}
          </a>
        )}
      </div>
    </Card>
  );
}

function StatusCard({ id, status, answer }: MessageView): ReactElement {
  const translate = useTranslate();
  return (
    <Card title={translate("panel.messages.detail.status")}>
      <p className="mt-3 mb-0">
        <StatusBadge status={status} />
      </p>
      {answer === null ? null : (
        <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-ink-subtle [overflow-wrap:anywhere]">
          <span className="block">
            {answer.by === null
              ? translate("panel.messages.detail.answeredOn")
              : translate("panel.messages.detail.answeredBy", {
                  name: answer.by,
                })}
          </span>
          <time dateTime={answer.dateTime}>{answer.date}</time>
        </p>
      )}
      <MessageActions messageId={id} status={status} />
    </Card>
  );
}

/** El detalle de un mensaje. Va dentro de `PanelShell`. */
export function MessageScreen(message: MessageView): ReactElement {
  const translate = useTranslate();
  const inboxPath = getPanelPath("adminMessages", useLanguage());
  const { name, notice } = message;
  return (
    <div className="max-w-[1100px]">
      <Link to={inboxPath} className={`mb-2 ${TEXT_LINK_STYLES}`}>
        <span aria-hidden="true" className="mr-1.5">
          ←
        </span>
        {translate("panel.messages.detail.back")}
      </Link>
      <PanelHeading
        title={name}
        documentTitle={translate("panel.messages.detail.documentTitle")}
        isLongTitle={name.length > LONG_NAME_LENGTH}
      />
      <div role="status">
        {notice === null ? null : (
          <p
            className={`mt-5 mb-0 rounded-control border-2 border-brand-night px-4 py-3 text-[15px] font-bold text-brand-night ${notice === "unchanged" ? "bg-surface-light" : "bg-brand-lime"}`}
          >
            {translate(NOTICE_KEYS[notice])}
          </p>
        )}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <BodyCard {...message} />
          <DataCard {...message} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <ReplyCard {...message} />
          <StatusCard {...message} />
        </div>
      </div>
    </div>
  );
}
