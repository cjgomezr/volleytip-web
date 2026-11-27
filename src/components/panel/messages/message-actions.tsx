import type { ReactElement } from "react";

import type { MessageStatus } from "~/lib/admin/messages";
import { getPanelPath, type PanelPageId } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { Button } from "../../button";
import { UnsentNotice } from "../unsent-notice";

interface StatusAction {
  readonly page: PanelPageId;
  readonly labelKey: MessageKey;
}

const ANSWER: StatusAction = {
  page: "adminMessageAnswer",
  labelKey: "panel.messages.action.answer",
};
const ARCHIVE: StatusAction = {
  page: "adminMessageArchive",
  labelKey: "panel.messages.action.archive",
};
const REOPEN: StatusAction = {
  page: "adminMessageReopen",
  labelKey: "panel.messages.action.reopen",
};

const ACTIONS: Record<MessageStatus, readonly StatusAction[]> = {
  new: [ANSWER, ARCHIVE],
  answered: [ARCHIVE],
  archived: [REOPEN],
};

function StatusButton({
  messageId,
  page,
  labelKey,
}: StatusAction & { readonly messageId: string }): ReactElement {
  const translate = useTranslate();
  const path = getPanelPath(page, useLanguage(), { messageId });
  const fetcher = usePanelFetcher();
  return (
    <fetcher.Form method="post" action={path} className="flex flex-col gap-2">
      {fetcher.isUnsent ? <UnsentNotice /> : null}
      <Button
        type="submit"
        variant="secondary"
        zone="light"
        submittingLabel={
          fetcher.isSending
            ? translate("panel.messages.action.saving")
            : undefined
        }
      >
        {translate(labelKey)}
      </Button>
    </fetcher.Form>
  );
}

/** Los cambios de estado que admite el mensaje. Son envíos: funcionan sin
 * JavaScript. No hay forma de borrarlo ni de editarlo. */
export function MessageActions({
  messageId,
  status,
}: {
  readonly messageId: string;
  readonly status: MessageStatus;
}): ReactElement {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {ACTIONS[status].map((action) => (
        <StatusButton key={action.page} messageId={messageId} {...action} />
      ))}
    </div>
  );
}
