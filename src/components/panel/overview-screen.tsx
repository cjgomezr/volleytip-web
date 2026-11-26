import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router";

import type {
  OverviewCardView,
  OverviewView,
  RejectionFormView,
  RejectionsView,
} from "~/lib/admin/overview";
import { useTranslate } from "~/lib/i18n/translations-context";

import {
  OUTLINE_INTERACTIVE_STYLES,
  OUTLINE_ZONE_STYLES,
  TRANSITION_STYLES,
} from "../pressable-styles";
import { ActivityRow } from "./activity-row";
import { PanelHeading } from "./panel-heading";

const CARD_STYLES =
  "flex h-full flex-col gap-1.5 rounded-card bg-surface-light p-4 md:p-5";
const LINK_CARD_STYLES = `group text-brand-night no-underline hovered:underline pressed:bg-brand-indigo pressed:text-brand-mist focused:outline-brand-night ${TRANSITION_STYLES}`;
const RETRY_STYLES = `mt-5 inline-flex min-h-11 items-center rounded-pill border-2 px-5 text-[14px] font-bold no-underline ${OUTLINE_ZONE_STYLES.light} ${OUTLINE_INTERACTIVE_STYLES.light} ${TRANSITION_STYLES}`;
const LIST_STYLES =
  "m-0 list-none overflow-hidden rounded-card bg-surface-light p-0";
const ROW_STYLES = "border-b border-line-light px-4 py-3 last:border-b-0";
// Sin color: cada aviso pone el suyo, porque dos colores en un mismo
// elemento se pisan.
const NOTICE_STYLES =
  "m-0 rounded-card bg-surface-light px-4 py-4 text-[15px] leading-[1.5]";
const EMPTY_STYLES = "text-ink-subtle";
const FAILURE_STYLES = "font-bold text-brand-red-deep";

function CardBody({ card }: { readonly card: OverviewCardView }): ReactElement {
  const translate = useTranslate();
  return (
    <>
      <span className="text-[13px] leading-[1.35] font-bold text-ink-subtle [overflow-wrap:anywhere] group-pressed:text-brand-mist">
        {translate(card.labelKey)}
      </span>
      {card.value.status === "failed" ? (
        <span
          className={`mt-auto text-[15px] leading-[1.4] group-pressed:text-brand-mist ${FAILURE_STYLES}`}
        >
          {translate("panel.overview.card.failed")}
        </span>
      ) : (
        <span className="mt-auto flex flex-wrap items-baseline gap-x-2 font-display text-[32px] leading-none [overflow-wrap:anywhere] sm:text-[40px]">
          <span data-overview-value>{card.value.value}</span>
          {card.href === undefined ? null : (
            <span
              aria-hidden="true"
              className="font-sans text-[28px] font-bold text-brand-red group-pressed:text-brand-mist"
            >
              →
            </span>
          )}
        </span>
      )}
    </>
  );
}

function OverviewCard({
  card,
}: {
  readonly card: OverviewCardView;
}): ReactElement {
  return (
    <li data-overview-card={card.id}>
      {card.href === undefined ? (
        <div className={CARD_STYLES}>
          <CardBody card={card} />
        </div>
      ) : (
        <Link to={card.href} className={`${CARD_STYLES} ${LINK_CARD_STYLES}`}>
          <CardBody card={card} />
        </Link>
      )}
    </li>
  );
}

function Section({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section aria-labelledby={id} className="mt-7">
      <h2
        id={id}
        className="mt-0 mb-3 text-[13px] leading-[1.4] font-bold tracking-[0.12em] text-ink-subtle uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Activity({
  activity,
}: {
  readonly activity: OverviewView["activity"];
}): ReactElement {
  const translate = useTranslate();
  if (activity.status === "failed") {
    return (
      <p className={`${NOTICE_STYLES} ${FAILURE_STYLES}`}>
        {translate("panel.overview.activity.failed")}
      </p>
    );
  }
  if (activity.value.length === 0) {
    return (
      <p className={`${NOTICE_STYLES} ${EMPTY_STYLES}`}>
        {translate("panel.overview.activity.empty")}
      </p>
    );
  }
  return (
    <ul className={LIST_STYLES}>
      {activity.value.map((entry) => (
        <ActivityRow key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

function RejectionForm({
  form,
}: {
  readonly form: RejectionFormView;
}): ReactElement {
  const translate = useTranslate();
  return (
    <li className={ROW_STYLES}>
      <p className="m-0 flex items-baseline justify-between gap-4 text-[15px] leading-[1.4] font-bold">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {form.labelKey ? translate(form.labelKey) : form.form}
        </span>
        <span className="shrink-0">{form.total}</span>
      </p>
      <dl className="m-0 mt-1 text-[14px] leading-[1.5] text-ink-subtle">
        {form.reasons.map((reason) => (
          <div key={reason.reason} className="flex justify-between gap-4">
            <dt className="min-w-0 [overflow-wrap:anywhere]">
              {reason.labelKey ? translate(reason.labelKey) : reason.reason}
            </dt>
            <dd className="m-0 shrink-0">{reason.count}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function RejectionList({
  rejections,
}: {
  readonly rejections: RejectionsView;
}): ReactElement {
  const translate = useTranslate();
  if (rejections.forms.length === 0) {
    return (
      <p className={`${NOTICE_STYLES} ${EMPTY_STYLES}`}>
        {translate("panel.overview.rejections.empty")}
      </p>
    );
  }
  return (
    <>
      <p className="mt-0 mb-3 text-[15px] leading-[1.5]">
        {translate("panel.overview.rejections.total", {
          total: rejections.total,
        })}
      </p>
      <ul className={LIST_STYLES}>
        {rejections.forms.map((form) => (
          <RejectionForm key={form.form} form={form} />
        ))}
      </ul>
    </>
  );
}

function Rejections({
  rejections,
}: {
  readonly rejections: OverviewView["rejections"];
}): ReactElement {
  const translate = useTranslate();
  if (rejections.status === "failed") {
    return (
      <p className={`${NOTICE_STYLES} ${FAILURE_STYLES}`}>
        {translate("panel.overview.rejections.failed")}
      </p>
    );
  }
  return <RejectionList rejections={rejections.value} />;
}

function hasFailure({ cards, activity, rejections }: OverviewView): boolean {
  return [...cards.map(({ value }) => value), activity, rejections].some(
    ({ status }) => status === "failed",
  );
}

/** Vuelve a pedir la pantalla. Es un enlace para que sirva sin JavaScript. */
function RetryLink(): ReactElement {
  const translate = useTranslate();
  const { pathname, search } = useLocation();
  return (
    <Link to={`${pathname}${search}`} replace className={RETRY_STYLES}>
      {translate("panel.overview.retry")}
    </Link>
  );
}

/** El resumen del panel (FR-059): lo que pide atención sin abrir cada
 * sección. Va dentro de `PanelShell`. */
export function OverviewScreen({
  greetingName,
  overview,
}: {
  /** El nombre del perfil o, si no tiene, el correo. */
  readonly greetingName: string;
  readonly overview: OverviewView;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className="max-w-[1100px]">
      <PanelHeading
        title={translate("panel.overview.greeting", { name: greetingName })}
        documentTitle={translate("panel.module.overview")}
        isLongTitle={greetingName.includes("@")}
      />
      {hasFailure(overview) ? <RetryLink /> : null}
      <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-3 p-0 max-lg:[&>li:last-child:nth-child(odd)]:col-span-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] lg:gap-4">
        {overview.cards.map((card) => (
          <OverviewCard key={card.id} card={card} />
        ))}
      </ul>
      <Section
        id="panel-overview-activity"
        title={translate("panel.overview.activity.title")}
      >
        <Activity activity={overview.activity} />
      </Section>
      <Section
        id="panel-overview-rejections"
        title={translate("panel.overview.rejections.title")}
      >
        <Rejections rejections={overview.rejections} />
      </Section>
    </div>
  );
}
