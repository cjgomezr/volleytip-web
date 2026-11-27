import { useState, type ReactElement } from "react";
import { Link, useFetcher } from "react-router";

import {
  FAQ_FORM_ERROR_KEYS,
  type FaqEditorView,
  type FaqFormError,
  type FaqSaveOutcome,
} from "~/lib/admin/faqs";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import {
  isUnsentSubmission,
  withoutUnsent,
  type UnsentSubmission,
} from "~/lib/panel/unsent-submission";

import { SaveBar } from "../editor-section";
import { TEXT_LINK_STYLES } from "../messages/message-styles";
import { PanelHeading } from "../panel-heading";
import { FaqLanguageTabs } from "./faq-language-tabs";
import { FaqStatusBadge } from "./faq-status-badge";

function useFormErrorText(
  formError: FaqFormError | null | undefined,
): string | undefined {
  const translate = useTranslate();
  if (!formError) return undefined;
  return translate(FAQ_FORM_ERROR_KEYS[formError]);
}

export interface FaqEditorScreenProps extends FaqEditorView {
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: FaqSaveOutcome;
}

/** El editor de una pregunta, nueva o existente, con una pestaña por idioma.
 * Va dentro de `PanelShell`. */
export function FaqEditorScreen({
  faqId,
  status,
  initialOutcome,
  ...view
}: FaqEditorScreenProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  // `useFetcher` y no `usePanelFetcher`: las pestañas necesitan lo enviado
  // (`formData`). Sus respuestas no hay que vencerlas: la pantalla se
  // desmonta al cambiar de dirección o de pregunta.
  const fetcher = useFetcher<FaqSaveOutcome | UnsentSubmission>();
  const outcome =
    fetcher.data === undefined ? initialOutcome : withoutUnsent(fetcher.data);
  const rejected = outcome?.status === "invalid" ? outcome : undefined;
  const [isEdited, setIsEdited] = useState(false);
  const formError = useFormErrorText(rejected?.formError);
  const isNew = faqId === null;
  const action = isNew
    ? getPanelPath("adminFaqNew", language)
    : getPanelPath("adminFaq", language, { faqId });
  return (
    <div className="max-w-[900px]">
      <PanelHeading
        title={translate(
          isNew ? "panel.faqs.editor.newTitle" : "panel.faqs.editor.editTitle",
        )}
      />
      <Link
        to={getPanelPath("adminFaqs", language)}
        className={`mt-2 ${TEXT_LINK_STYLES}`}
      >
        {translate("panel.faqs.editor.back")}
      </Link>
      <div className="mt-3 rounded-card bg-surface-light p-4 md:p-6">
        {status === null ? null : <FaqStatusBadge status={status} />}
        <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-ink-subtle">
          {translate(
            isNew
              ? "panel.faqs.editor.newIntro"
              : "panel.faqs.editor.editIntro",
          )}
        </p>
        <fetcher.Form
          method="post"
          action={action}
          noValidate
          onInput={() => setIsEdited(true)}
          onSubmit={() => setIsEdited(false)}
        >
          <FaqLanguageTabs
            {...view}
            rejected={rejected}
            submitted={fetcher.formData}
          />
          <SaveBar
            submitLabel={translate(
              isNew ? "panel.faqs.editor.create" : "panel.faqs.editor.save",
            )}
            isSaving={fetcher.state !== "idle"}
            isEdited={isEdited}
            status={outcome?.status}
            isUnsent={isUnsentSubmission(fetcher.data)}
            formError={formError}
          />
        </fetcher.Form>
      </div>
    </div>
  );
}
