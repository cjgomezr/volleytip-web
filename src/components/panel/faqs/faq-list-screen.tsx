import type { ReactElement } from "react";
import { Link, useFetcher } from "react-router";

import type { FaqListOutcome, FaqListView } from "~/lib/admin/faqs";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { getButtonLinkClassName } from "../../button";
import { PanelHeading } from "../panel-heading";
import { FaqListItem } from "./faq-list-item";
import { useFaqFocus } from "./use-faq-focus";

function useNoticeText(
  outcome: FaqListOutcome | undefined,
  hasCreated: boolean,
): string | undefined {
  const translate = useTranslate();
  if (outcome === undefined) {
    return hasCreated ? translate("panel.faqs.notice.created") : undefined;
  }
  switch (outcome.status) {
    case "published":
      return translate("panel.faqs.notice.published");
    case "retired":
      return translate("panel.faqs.notice.retired");
    case "moved":
      return translate("panel.faqs.notice.moved", { number: outcome.position });
    case "unchanged":
      return translate("panel.faqs.notice.unchanged");
    case "invalid":
      return undefined;
  }
}

// La región existe siempre: un lector de pantalla solo anuncia lo que cambia
// dentro de una región que ya estaba en la página.
function Notice({ text }: { readonly text?: string }): ReactElement {
  return (
    <div role="status">
      {text === undefined ? null : (
        <p className="mt-4 mb-0 inline-flex items-center gap-2 rounded-pill bg-brand-lime px-4 py-2 text-[15px] font-bold text-brand-night">
          <span aria-hidden="true">✓</span>
          {text}
        </p>
      )}
    </div>
  );
}

function EmptyList({ newPath }: { readonly newPath: string }): ReactElement {
  const translate = useTranslate();
  return (
    <div className="mt-5 flex flex-col items-start gap-4 rounded-card bg-surface-light p-5 md:p-6">
      <p className="m-0 text-[16px] leading-[1.5] text-ink-subtle">
        {translate("panel.faqs.empty")}
      </p>
      <Link to={newPath} className={getButtonLinkClassName("primary", "light")}>
        {translate("panel.faqs.createFirst")}
      </Link>
    </div>
  );
}

export interface FaqListScreenProps extends FaqListView {
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: FaqListOutcome;
}

/** Las preguntas frecuentes del panel (FR-137), en el orden del sitio. Va
 * dentro de `PanelShell`. */
export function FaqListScreen({
  rows,
  createdId,
  initialOutcome,
}: FaqListScreenProps): ReactElement {
  const translate = useTranslate();
  const newPath = getPanelPath("adminFaqNew", useLanguage());
  // Uno solo para todos los botones: lo último que pasó es lo que se anuncia.
  const fetcher = useFetcher<FaqListOutcome>();
  const isIdle = fetcher.state === "idle";
  // Mientras envía no se muestra el resultado anterior, así se vuelve a
  // anunciar el nuevo aunque diga lo mismo.
  const outcome = isIdle ? (fetcher.data ?? initialOutcome) : undefined;
  const listRef = useFaqFocus(isIdle ? fetcher.data : undefined);
  const notice = useNoticeText(outcome, isIdle && createdId !== null);
  return (
    <div className="max-w-[900px]">
      <PanelHeading title={translate("panel.module.faqs")} />
      {rows.length === 0 ? (
        <EmptyList newPath={newPath} />
      ) : (
        <>
          <p className="mt-3 mb-4 text-[14px] leading-[1.5] text-ink-subtle">
            {translate("panel.faqs.intro")}
          </p>
          <Link
            to={newPath}
            className={getButtonLinkClassName("primary", "light")}
          >
            {translate("panel.faqs.new")}
          </Link>
        </>
      )}
      <Notice text={notice} />
      <ol ref={listRef} className="mt-4 mb-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row, index) => (
          <FaqListItem
            key={row.id}
            row={row}
            position={index + 1}
            isLast={index === rows.length - 1}
            Form={fetcher.Form}
            error={
              outcome?.status === "invalid" && outcome.faqId === row.id
                ? outcome.error
                : undefined
            }
          />
        ))}
      </ol>
    </div>
  );
}
