import type { ReactElement } from "react";

import {
  REASON_LABEL_KEYS,
  STATUS_LABEL_KEYS,
  type MessageStatus,
} from "~/lib/admin/messages";
import type { MessageReason } from "~/lib/messages.server";
import { useTranslate } from "~/lib/i18n/translations-context";

const BADGE_STYLES =
  "inline-block max-w-full rounded-pill px-3 py-1 text-[13px] leading-[1.4] font-bold [overflow-wrap:anywhere]";

// El color acompaña al texto, que es el que dice el estado. Sobre rojo y lima
// el texto va en noche.
const STATUS_STYLES: Record<MessageStatus, string> = {
  new: "bg-brand-red text-brand-night",
  answered: "bg-brand-lime text-brand-night",
  archived: "bg-brand-mist text-brand-night",
};

export function StatusBadge({
  status,
}: {
  readonly status: MessageStatus;
}): ReactElement {
  const translate = useTranslate();
  return (
    <span
      data-message-status={status}
      className={`${BADGE_STYLES} ${STATUS_STYLES[status]}`}
    >
      {translate(STATUS_LABEL_KEYS[status])}
    </span>
  );
}

export function ReasonBadge({
  reason,
}: {
  readonly reason: MessageReason;
}): ReactElement {
  const translate = useTranslate();
  return (
    <span className={`${BADGE_STYLES} bg-brand-night text-brand-mist`}>
      {translate(REASON_LABEL_KEYS[reason])}
    </span>
  );
}
