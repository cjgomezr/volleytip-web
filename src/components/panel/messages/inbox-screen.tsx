import type { ReactElement } from "react";
import { Link } from "react-router";

import { hasInboxFilters, type InboxView } from "~/lib/admin/messages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { getButtonLinkClassName } from "../../button";
import { PanelHeading } from "../panel-heading";
import { InboxFilters } from "./inbox-filters";
import { MessageList } from "./message-list";
import { CARD_STYLES, TEXT_LINK_STYLES } from "./message-styles";

function EmptyInbox({
  isFiltered,
  inboxPath,
}: {
  readonly isFiltered: boolean;
  readonly inboxPath: string;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className={`mt-4 ${CARD_STYLES} ${isFiltered ? "!pb-3" : ""}`}>
      <p className="m-0 text-[16px] leading-[1.5] text-ink-subtle">
        {translate(
          isFiltered ? "panel.messages.noResults" : "panel.messages.empty",
        )}
      </p>
      {isFiltered ? (
        <Link to={inboxPath} className={`mt-2 ${TEXT_LINK_STYLES}`}>
          {translate("panel.messages.filters.clear")}
        </Link>
      ) : null}
    </div>
  );
}

type PaginationProps = Pick<
  InboxView,
  "page" | "pageCount" | "previousHref" | "nextHref"
>;

function Pagination({
  page,
  pageCount,
  previousHref,
  nextHref,
}: PaginationProps): ReactElement {
  const translate = useTranslate();
  const linkStyles = getButtonLinkClassName("secondary", "light");
  return (
    <nav
      aria-label={translate("panel.messages.pages.label")}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="m-0 text-[14px] text-ink-subtle">
        {translate("panel.messages.pages.current", { page, pageCount })}
      </p>
      <div className="flex flex-wrap gap-3">
        {previousHref === null ? null : (
          <Link to={previousHref} rel="prev" className={linkStyles}>
            {translate("panel.messages.pages.previous")}
          </Link>
        )}
        {nextHref === null ? null : (
          <Link to={nextHref} rel="next" className={linkStyles}>
            {translate("panel.messages.pages.next")}
          </Link>
        )}
      </div>
    </nav>
  );
}

/** La bandeja de mensajes (FR-064). Va dentro de `PanelShell`. */
export function InboxScreen({
  query,
  rows,
  total,
  ...pagination
}: InboxView): ReactElement {
  const translate = useTranslate();
  const inboxPath = getPanelPath("adminMessages", useLanguage());
  const isFiltered = hasInboxFilters(query);
  const isEmpty = rows.length === 0;
  return (
    <div className="max-w-[1100px]">
      <PanelHeading title={translate("panel.module.messages")} />
      <InboxFilters
        query={query}
        inboxPath={inboxPath}
        canClear={isFiltered && !isEmpty}
      />
      {/* La región existe siempre: así un lector de pantalla anuncia cuántos
          quedan al filtrar. */}
      <p role="status" className="mt-5 mb-0 text-[14px] text-ink-subtle">
        {isEmpty ? null : translate("panel.messages.total", { count: total })}
      </p>
      {isEmpty ? (
        <EmptyInbox isFiltered={isFiltered} inboxPath={inboxPath} />
      ) : (
        <MessageList rows={rows} />
      )}
      {pagination.pageCount > 1 ? <Pagination {...pagination} /> : null}
    </div>
  );
}
