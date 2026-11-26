import type { ReactElement } from "react";
import { Link } from "react-router";

import type { AuditListView, AuditPaginationView } from "~/lib/admin/audit-log";
import { useTranslate } from "~/lib/i18n/translations-context";

import { getButtonLinkClassName } from "../button";
import { ActivityRow } from "./activity-row";
import { AuditLogFilters, ClearFiltersLink } from "./audit-log-filters";
import { PanelHeading } from "./panel-heading";

const PAGE_LINK_STYLES = getButtonLinkClassName("secondary", "light");

function Pagination({
  page,
  pageCount,
  total,
  previousHref,
  nextHref,
}: AuditPaginationView): ReactElement {
  const translate = useTranslate();
  return (
    <nav
      aria-label={translate("panel.auditLog.pagination.label")}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="m-0 text-[14px] leading-[1.5] text-ink-subtle">
        {translate("panel.auditLog.pagination.status", {
          page,
          pageCount,
          total,
        })}
      </p>
      <div className="flex flex-wrap gap-3">
        {previousHref === undefined ? null : (
          <Link to={previousHref} className={PAGE_LINK_STYLES}>
            {translate("panel.auditLog.pagination.previous")}
          </Link>
        )}
        {nextHref === undefined ? null : (
          <Link to={nextHref} className={PAGE_LINK_STYLES}>
            {translate("panel.auditLog.pagination.next")}
          </Link>
        )}
      </div>
    </nav>
  );
}

function EmptyNotice({
  state,
  clearHref,
}: {
  readonly state: "empty" | "inverted";
  readonly clearHref: string;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className="mt-5 flex flex-col items-start gap-4 rounded-card bg-surface-light p-5">
      <p
        className={`m-0 text-[15px] leading-[1.5] ${state === "inverted" ? "font-bold text-brand-red-deep" : "text-ink-subtle"}`}
      >
        {translate(
          state === "inverted"
            ? "panel.auditLog.invertedRange"
            : "panel.auditLog.empty",
        )}
      </p>
      <ClearFiltersLink href={clearHref} />
    </div>
  );
}

/** La pantalla "Bitácora" (FR-067). Solo se lee. Va dentro de `PanelShell`. */
export function AuditLogScreen({
  state,
  entries,
  options,
  filters,
  isFiltered,
  pagination,
  clearHref,
}: AuditListView): ReactElement {
  const translate = useTranslate();
  return (
    <div className="max-w-[1100px]">
      <PanelHeading title={translate("panel.module.auditLog")} />
      <AuditLogFilters
        filters={filters}
        options={options}
        clearHref={clearHref}
        canClear={isFiltered && state === "entries"}
      />
      {state === "entries" ? (
        <>
          <ul className="m-0 mt-5 list-none overflow-hidden rounded-card bg-surface-light p-0">
            {entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} href={entry.href} />
            ))}
          </ul>
          <Pagination {...pagination} />
        </>
      ) : (
        <EmptyNotice state={state} clearHref={clearHref} />
      )}
    </div>
  );
}
