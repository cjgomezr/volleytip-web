import type { ReactElement } from "react";
import { Link, type FetcherWithComponents } from "react-router";

import {
  DIRECTION_FIELD,
  FAQ_LIST_ERROR_KEYS,
  type FaqLanguage,
  type FaqListError,
  type FaqListOutcome,
  type FaqRowView,
} from "~/lib/admin/faqs";
import { getPanelPath, type PanelPageId } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { Button, getButtonLinkClassName } from "../../button";
import { FaqStatusBadge } from "./faq-status-badge";

type FaqFetcher = FetcherWithComponents<FaqListOutcome>;

interface FaqListItemProps {
  readonly row: FaqRowView;
  /** Su lugar en el sitio, desde 1. */
  readonly position: number;
  readonly isLast: boolean;
  /** El envío que comparten los botones de la lista. */
  readonly fetcher: FaqFetcher;
  readonly error?: FaqListError;
}

function LanguageChips({
  languages,
}: {
  readonly languages: readonly FaqLanguage[];
}): ReactElement {
  const translate = useTranslate();
  return (
    <ul
      aria-label={translate("panel.faqs.languages")}
      className="m-0 flex list-none flex-wrap gap-2 p-0"
    >
      {languages.map(({ code, name, isTranslated }) => (
        <li
          key={code}
          data-translated={isTranslated}
          className={`rounded-pill border-2 px-3 py-1 text-[13px] font-bold text-brand-night ${isTranslated ? "border-brand-night" : "border-dashed border-ink-subtle"}`}
        >
          <span aria-hidden="true">{isTranslated ? "✓ " : "— "}</span>
          {name}
          {": "}
          {translate(
            isTranslated ? "panel.faqs.translated" : "panel.faqs.notTranslated",
          )}
        </li>
      ))}
    </ul>
  );
}

// Lo que le pasa en el sitio a una publicada a la que le falta un idioma
// (AC-065).
function useSiteWarnings({ status, languages }: FaqRowView): string[] {
  const translate = useTranslate();
  const fallback = languages.find(({ isDefault }) => isDefault);
  if (status !== "published" || fallback === undefined) return [];
  if (!fallback.isTranslated) {
    return [
      translate("panel.faqs.missingDefault", { language: fallback.name }),
    ];
  }
  return languages
    .filter(({ isTranslated }) => !isTranslated)
    .map(({ code, name }) =>
      translate("panel.faqs.missingTranslation", {
        language: name,
        code,
        fallback: fallback.name,
      }),
    );
}

interface ActionButtonProps {
  readonly fetcher: FaqFetcher;
  readonly page: PanelPageId;
  readonly faqId: string;
  /** Con él se busca a quién darle el foco después del envío. */
  readonly control: "up" | "down" | "status";
  readonly text: string;
  readonly label: string;
  readonly isDisabled?: boolean;
}

function ActionButton({
  fetcher,
  page,
  faqId,
  control,
  text,
  label,
  isDisabled = false,
}: ActionButtonProps): ReactElement {
  const translate = useTranslate();
  const action = getPanelPath(page, useLanguage(), { faqId });
  const isBusy = fetcher.state !== "idle";
  const isSending =
    isBusy &&
    fetcher.formAction === action &&
    (control === "status" ||
      fetcher.formData?.get(DIRECTION_FIELD) === control);
  return (
    <fetcher.Form
      method="post"
      action={action}
      data-faq-action={control}
      // Un envío nuevo cancelaría el que está en curso, que podría no llegar a
      // guardarse.
      onSubmit={(event) => {
        if (isBusy) event.preventDefault();
      }}
    >
      {control === "status" ? null : (
        <input type="hidden" name={DIRECTION_FIELD} value={control} />
      )}
      <Button
        type="submit"
        variant="secondary"
        zone="light"
        aria-label={label}
        isDisabled={isDisabled}
        submittingLabel={
          isSending ? translate("panel.siteTexts.saving") : undefined
        }
      >
        {text}
      </Button>
    </fetcher.Form>
  );
}

function ItemActions({
  row,
  position,
  isLast,
  fetcher,
}: Omit<FaqListItemProps, "error">): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const shared = { fetcher, faqId: row.id };
  const isPublished = row.status === "published";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to={getPanelPath("adminFaq", language, { faqId: row.id })}
        aria-label={translate("panel.faqs.editLabel", { number: position })}
        className={getButtonLinkClassName("secondary", "light")}
      >
        {translate("panel.faqs.edit")}
      </Link>
      <ActionButton
        {...shared}
        page="adminFaqMove"
        control="up"
        text={translate("panel.faqs.up")}
        label={translate("panel.faqs.upLabel", { number: position })}
        isDisabled={position === 1}
      />
      <ActionButton
        {...shared}
        page="adminFaqMove"
        control="down"
        text={translate("panel.faqs.down")}
        label={translate("panel.faqs.downLabel", { number: position })}
        isDisabled={isLast}
      />
      <ActionButton
        {...shared}
        page={isPublished ? "adminFaqRetire" : "adminFaqPublish"}
        control="status"
        text={translate(
          isPublished ? "panel.faqs.retire" : "panel.faqs.publish",
        )}
        label={translate(
          isPublished ? "panel.faqs.retireLabel" : "panel.faqs.publishLabel",
          { number: position },
        )}
      />
    </div>
  );
}

/** Una pregunta de la lista, con su estado, sus idiomas y sus botones. No hay
 * forma de borrarla. */
export function FaqListItem({
  row,
  error,
  ...actions
}: FaqListItemProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const warnings = useSiteWarnings(row);
  const { question, questionLanguage } = row;
  return (
    <li
      data-faq-row={row.id}
      className="flex min-w-0 flex-col gap-3 rounded-card bg-surface-light p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-[26px] leading-none">
          {actions.position}
        </span>
        <FaqStatusBadge status={row.status} />
      </div>
      <h2
        lang={
          questionLanguage === "" || questionLanguage === language
            ? undefined
            : questionLanguage
        }
        className="m-0 text-[17px] leading-[1.4] font-bold [overflow-wrap:anywhere]"
      >
        {question === "" ? translate("panel.faqs.untitled") : question}
      </h2>
      <LanguageChips languages={row.languages} />
      {warnings.map((warning) => (
        <p
          key={warning}
          data-faq-warning
          className="m-0 flex items-start gap-2 text-[14px] leading-[1.5] font-semibold [overflow-wrap:anywhere]"
        >
          <span aria-hidden="true">⚠</span>
          {warning}
        </p>
      ))}
      <ItemActions row={row} {...actions} />
      {error === undefined ? null : (
        <p
          role="alert"
          className="m-0 text-[14px] leading-[1.5] font-bold text-brand-red-deep"
        >
          <span aria-hidden="true">⚠ </span>
          {translate(FAQ_LIST_ERROR_KEYS[error])}
        </p>
      )}
    </li>
  );
}
