import { useState, type ReactElement } from "react";

import {
  MESSAGE_COUNT_FIELD,
  messageField,
  type BarOutcome,
  type FieldErrors,
  type SiteTextsLimits,
  type SiteTextsView,
} from "~/lib/admin/site-texts";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { Button } from "../button";
import { AnnouncementMessageFields } from "./announcement-message-fields";
import { EditorSection, SaveBar, useFieldErrorText } from "./editor-section";
import { useMessageRows, type MessageRows } from "./use-message-rows";
import { PreloadSubmission } from "./preload-submission";

interface AnnouncementEditorProps {
  readonly bar: SiteTextsView["bar"];
  readonly limits: SiteTextsLimits;
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: BarOutcome;
}

// Un envío rechazado se vuelve a pintar con lo escrito; si llegó incompleto
// no hay qué repintar y salen los guardados.
function pickInitialMessages({
  bar,
  initialOutcome,
}: AnnouncementEditorProps): SiteTextsView["bar"]["messages"] {
  const isEchoed =
    initialOutcome?.status === "invalid" &&
    initialOutcome.formError !== "malformed";
  return isEchoed ? initialOutcome.values : bar.messages;
}

function InvalidStoredValue({
  value,
}: {
  readonly value: string;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className="mt-4 rounded-card border-2 border-brand-red-deep p-3">
      <p className="m-0 text-[15px] leading-[1.5] font-bold text-brand-red-deep">
        {translate("panel.siteTexts.bar.invalidStored")}
      </p>
      <p className="mt-3 mb-1 text-[13px] font-bold">
        {translate("panel.siteTexts.bar.storedValue")}
      </p>
      <pre className="m-0 text-[13px] leading-[1.5] whitespace-pre-wrap [overflow-wrap:anywhere]">
        {value}
      </pre>
    </div>
  );
}

function MessageList({
  messages,
  limits,
  fieldErrors,
  sentRows,
}: {
  readonly messages: MessageRows;
  readonly limits: SiteTextsLimits;
  readonly fieldErrors: FieldErrors;
  /** Los mensajes en el orden en que se enviaron: los errores van por
   * posición y la persona puede reordenar antes de reintentar. */
  readonly sentRows: MessageRows["rows"];
}): ReactElement {
  const errorText = useFieldErrorText();
  const translate = useTranslate();
  const { rows, listRef, add, edit, apply } = messages;
  return (
    <div ref={listRef} className="mt-4 flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="m-0 text-[15px] leading-[1.5]">
          {translate("panel.siteTexts.bar.empty")}
        </p>
      ) : null}
      {rows.map((row, position) => {
        const sentAt = sentRows.findIndex(({ id }) => id === row.id);
        const readError = (language: "es" | "en"): string | undefined =>
          errorText(
            fieldErrors[messageField(sentAt, language)],
            limits.maxMessageLength,
          );
        return (
          <AnnouncementMessageFields
            key={row.id}
            row={row}
            number={position + 1}
            isLast={position === rows.length - 1}
            errors={{ es: readError("es"), en: readError("en") }}
            onChange={(language, text) => edit(row.id, language, text)}
            onAction={(action) => apply(position, action)}
          />
        );
      })}
      <div data-add-message className="flex flex-col items-start gap-2">
        <Button
          variant="secondary"
          zone="light"
          isDisabled={rows.length >= limits.maxMessages}
          onClick={add}
        >
          {translate("panel.siteTexts.bar.add")}
        </Button>
        <p className="m-0 text-[13px] text-ink-subtle">
          {translate("panel.siteTexts.bar.max", { max: limits.maxMessages })}
        </p>
      </div>
    </div>
  );
}

function ListAnnouncer({
  change,
}: {
  readonly change: MessageRows["lastChange"];
}): ReactElement {
  const translate = useTranslate();
  let text = "";
  if (change?.kind === "moved") {
    text = translate("panel.siteTexts.bar.moved", { number: change.number });
  } else if (change?.kind === "removed") {
    text = translate("panel.siteTexts.bar.removed", { number: change.number });
  }
  return (
    <p role="status" className="sr-only">
      {/* Un nodo nuevo por cambio: dos iguales seguidos se anuncian. */}
      <span key={change?.sequence}>{text}</span>
    </p>
  );
}

function useFormError(
  outcome: BarOutcome | undefined,
  maxMessages: number,
): string | undefined {
  const translate = useTranslate();
  if (outcome?.status !== "invalid" || outcome.formError === null) {
    return undefined;
  }
  return outcome.formError === "tooMany"
    ? translate("panel.siteTexts.bar.tooMany", { max: maxMessages })
    : translate("panel.siteTexts.error.malformed");
}

/** La barra de anuncios: sus mensajes en cada idioma y en su orden. */
export function AnnouncementEditor(
  props: AnnouncementEditorProps,
): ReactElement {
  const { bar, limits, initialOutcome } = props;
  const translate = useTranslate();
  const fetcher = usePanelFetcher<BarOutcome>(initialOutcome);
  const { outcome } = fetcher;
  const messages = useMessageRows(pickInitialMessages(props));
  const [sentRows, setSentRows] = useState(messages.rows);
  const formError = useFormError(outcome, limits.maxMessages);
  const isSaving = fetcher.isSending;
  // Mientras envía, los errores son del intento anterior y ya no cuadran.
  const fieldErrors =
    !isSaving && outcome?.status === "invalid" ? outcome.fieldErrors : {};
  const action = getPanelPath("adminSiteTextsAnnouncements", useLanguage());
  return (
    <EditorSection
      id="site-texts-bar"
      title={translate("panel.siteTexts.bar.title")}
      intro={`${translate("panel.siteTexts.bar.intro")} ${translate("panel.siteTexts.maxLength", { max: limits.maxMessageLength })}`}
    >
      {bar.invalidValue === null ? null : (
        <InvalidStoredValue value={bar.invalidValue} />
      )}
      <fetcher.Form
        method="post"
        action={action}
        noValidate
        onSubmit={() => setSentRows(messages.rows)}
      >
        <PreloadSubmission action={action} />
        <input
          type="hidden"
          name={MESSAGE_COUNT_FIELD}
          value={messages.rows.length}
        />
        <MessageList
          messages={messages}
          limits={limits}
          fieldErrors={fieldErrors}
          sentRows={sentRows}
        />
        <ListAnnouncer change={messages.lastChange} />
        <SaveBar
          submitLabel={translate("panel.siteTexts.bar.save")}
          isSaving={isSaving}
          // Cada cambio de la lista, y cada tecla, crea otra lista.
          isEdited={messages.rows !== sentRows}
          status={outcome?.status}
          isUnsent={fetcher.isUnsent}
          formError={formError}
        />
      </fetcher.Form>
    </EditorSection>
  );
}
