import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import type {
  AuditChangeView,
  AuditEntryView,
  AuditValue,
} from "~/lib/admin/audit-log";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

import { getButtonLinkClassName } from "../button";
import { PanelHeading } from "./panel-heading";

const CARD_STYLES = "rounded-card bg-surface-light p-4 md:p-5";
const TERM_STYLES = "text-[13px] leading-[1.4] font-bold text-ink-subtle";
// Conserva los saltos de línea y parte lo que no cabe: nada se desborda.
const VALUE_STYLES =
  "m-0 mt-1 text-[15px] leading-[1.5] whitespace-pre-wrap [overflow-wrap:anywhere]";

function Value({ value }: { readonly value: AuditValue }): ReactElement {
  const translate = useTranslate();
  if (value.kind === "text") {
    return <dd className={VALUE_STYLES}>{value.text}</dd>;
  }
  return (
    <dd className={`${VALUE_STYLES} text-ink-subtle italic`}>
      {translate(
        value.kind === "empty"
          ? "panel.auditLog.value.empty"
          : "panel.auditLog.value.absent",
      )}
    </dd>
  );
}

function Field({
  term,
  children,
}: {
  readonly term: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div className="min-w-0">
      <dt className={TERM_STYLES}>{term}</dt>
      {children}
    </div>
  );
}

function Section({
  titleKey,
  children,
}: {
  readonly titleKey: MessageKey;
  readonly children: ReactNode;
}): ReactElement {
  const translate = useTranslate();
  return (
    <section className="mt-7">
      <h2 className="mt-0 mb-3 text-[13px] leading-[1.4] font-bold tracking-[0.12em] text-ink-subtle uppercase">
        {translate(titleKey)}
      </h2>
      {children}
    </section>
  );
}

function Summary({
  action,
  entity,
  entityId,
  actorName,
  dateTime,
  date,
}: AuditEntryView): ReactElement {
  const translate = useTranslate();
  return (
    <dl className={`m-0 mt-5 grid gap-4 sm:grid-cols-2 ${CARD_STYLES}`}>
      <Field term={translate("panel.auditLog.entry.when")}>
        <dd className={VALUE_STYLES}>
          <time dateTime={dateTime}>{date}</time>
        </dd>
      </Field>
      <Field term={translate("panel.auditLog.entry.who")}>
        <dd className={VALUE_STYLES}>
          {actorName ?? translate("panel.overview.activity.system")}
        </dd>
      </Field>
      <Field term={translate("panel.auditLog.entry.action")}>
        <dd className={VALUE_STYLES}>{action}</dd>
      </Field>
      <Field term={translate("panel.auditLog.entry.entity")}>
        <dd className={VALUE_STYLES}>{entity}</dd>
      </Field>
      {entityId === null ? null : (
        <Field term={translate("panel.auditLog.entry.entityId")}>
          <dd className={VALUE_STYLES}>{entityId}</dd>
        </Field>
      )}
    </dl>
  );
}

function Change({ field, before, after }: AuditChangeView): ReactElement {
  const translate = useTranslate();
  return (
    <li data-audit-field={field} className={CARD_STYLES}>
      <h3 className="m-0 text-[16px] leading-[1.4] font-bold [overflow-wrap:anywhere]">
        {field}
      </h3>
      <dl className="m-0 mt-3 grid gap-3 md:grid-cols-2 md:gap-5">
        <Field term={translate("panel.auditLog.entry.before")}>
          <Value value={before} />
        </Field>
        <Field term={translate("panel.auditLog.entry.after")}>
          <Value value={after} />
        </Field>
      </dl>
    </li>
  );
}

/** El detalle de una entrada de la bitácora. Todo valor se pinta como texto.
 * Va dentro de `PanelShell`. */
export function AuditEntryScreen(entry: AuditEntryView): ReactElement {
  const translate = useTranslate();
  const { changes, extras, backHref } = entry;
  return (
    <div className="max-w-[900px]">
      <Link
        to={backHref}
        className={`mb-5 ${getButtonLinkClassName("secondary", "light")}`}
      >
        {translate("panel.auditLog.entry.back")}
      </Link>
      <PanelHeading title={translate("panel.auditLog.entry.title")} />
      <Summary {...entry} />
      {changes.length === 0 ? null : (
        <Section titleKey="panel.auditLog.entry.changes">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {changes.map((change) => (
              <Change key={change.field} {...change} />
            ))}
          </ul>
        </Section>
      )}
      {extras.length === 0 ? null : (
        <Section titleKey="panel.auditLog.entry.data">
          <dl className={`m-0 flex flex-col gap-3 ${CARD_STYLES}`}>
            {extras.map(({ field, value }) => (
              <Field key={field} term={field}>
                <Value value={value} />
              </Field>
            ))}
          </dl>
        </Section>
      )}
      {changes.length + extras.length === 0 ? (
        <p className={`mt-5 mb-0 text-[15px] text-ink-subtle ${CARD_STYLES}`}>
          {translate("panel.auditLog.entry.noData")}
        </p>
      ) : null}
    </div>
  );
}
