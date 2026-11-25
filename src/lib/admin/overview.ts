import { formatDate, formatNumber } from "../i18n/format";
import type { Language } from "../i18n/languages";
import { buildPagePath } from "../i18n/page-path";
import { findLanguage } from "../i18n/pages";
import type { MessageKey } from "../i18n/translate";
import type { AdminModule } from "./modules";

/** Un dato del resumen que se leyó, o cuya consulta falló. */
export type Loaded<Value> =
  | { readonly status: "ok"; readonly value: Value }
  | { readonly status: "failed" };

/** El módulo cuya página abre una tarjeta, si está registrado. */
export interface CardLink {
  readonly moduleId: string;
  /** El filtro con que se abre la página: `?estado=new`. */
  readonly search?: string;
}

export interface CardData {
  readonly id: string;
  readonly labelKey: MessageKey;
  readonly link: CardLink;
  readonly count: Loaded<number>;
}

export interface ActivityEntry {
  readonly id: string;
  readonly createdAt: string;
  /** Nulo cuando la acción no la hizo una persona. */
  readonly actorName: string | null;
  readonly action: string;
}

/** Los envíos descartados de un formulario por un motivo en un día. */
export interface RejectionCount {
  readonly form: string;
  readonly reason: string;
  readonly count: number;
}

/** Lo que el resumen leyó de la base, sin formato. */
export interface OverviewData {
  readonly cards: readonly CardData[];
  readonly activity: Loaded<readonly ActivityEntry[]>;
  readonly rejections: Loaded<readonly RejectionCount[]>;
}

export interface OverviewCardView {
  readonly id: string;
  readonly labelKey: MessageKey;
  readonly value: Loaded<string>;
  /** Ausente cuando la tarjeta no es un enlace. */
  readonly href?: string;
}

export interface ActivityView {
  readonly id: string;
  readonly action: string;
  readonly actorName: string | null;
  /** La fecha para `<time>`. */
  readonly dateTime: string;
  readonly date: string;
}

export interface RejectionReasonView {
  readonly reason: string;
  /** Ausente si el panel no conoce el motivo: se muestra su id. */
  readonly labelKey?: MessageKey;
  readonly count: string;
}

export interface RejectionFormView {
  readonly form: string;
  /** Ausente si el panel no conoce el formulario: se muestra su id. */
  readonly labelKey?: MessageKey;
  readonly total: string;
  readonly reasons: readonly RejectionReasonView[];
}

export interface RejectionsView {
  readonly total: string;
  readonly forms: readonly RejectionFormView[];
}

/** El resumen listo para pintar. Fechas y números salen del servidor ya en el
 * idioma del panel, para que servidor y navegador pinten lo mismo. */
export interface OverviewView {
  readonly cards: readonly OverviewCardView[];
  readonly activity: Loaded<readonly ActivityView[]>;
  readonly rejections: Loaded<RejectionsView>;
}

interface ViewOptions {
  readonly modules: readonly AdminModule[];
  readonly language: Language;
}

// Por el id con que cada formulario cuenta sus rechazos.
const FORM_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  contact: "panel.overview.form.contact",
  app_waitlist: "panel.overview.form.appWaitlist",
  camp_notify: "panel.overview.form.campNotify",
  admin_sign_in: "panel.overview.form.adminSignIn",
};

// Los motivos que admite `form_rejections`.
const REASON_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  turnstile: "panel.overview.reason.turnstile",
  honeypot: "panel.overview.reason.honeypot",
  too_fast: "panel.overview.reason.tooFast",
  rate_limit: "panel.overview.reason.rateLimit",
  validation: "panel.overview.reason.validation",
};

function mapLoaded<Value, Result>(
  loaded: Loaded<Value>,
  transform: (value: Value) => Result,
): Loaded<Result> {
  if (loaded.status === "failed") return loaded;
  return { status: "ok", value: transform(loaded.value) };
}

function buildHref(
  { moduleId, search = "" }: CardLink,
  { modules, language }: ViewOptions,
): string | undefined {
  const target = modules.find(({ id }) => id === moduleId);
  if (target === undefined) return undefined;
  return `${buildPagePath(target.page, findLanguage(language))}${search}`;
}

function buildCard(
  { id, labelKey, link, count }: CardData,
  options: ViewOptions,
): OverviewCardView {
  return {
    id,
    labelKey,
    value: mapLoaded(count, (value) => formatNumber(value, options.language)),
    href: buildHref(link, options),
  };
}

function buildActivity(
  { id, action, actorName, createdAt }: ActivityEntry,
  language: Language,
): ActivityView {
  return {
    id,
    action,
    actorName,
    dateTime: createdAt,
    date: formatDate(new Date(createdAt), language, {
      style: "short",
      withTime: true,
    }),
  };
}

// Suma por clave y ordena de mayor a menor; los empates, por la clave.
function totalByKey(
  rows: readonly RejectionCount[],
  key: "form" | "reason",
): readonly (readonly [string, number])[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row[key], (totals.get(row[key]) ?? 0) + row.count);
  }
  return [...totals].sort(
    ([firstKey, first], [secondKey, second]) =>
      second - first || firstKey.localeCompare(secondKey),
  );
}

function buildRejectionForm(
  [form, total]: readonly [string, number],
  rows: readonly RejectionCount[],
  language: Language,
): RejectionFormView {
  const formRows = rows.filter((row) => row.form === form);
  return {
    form,
    labelKey: FORM_LABEL_KEYS[form],
    total: formatNumber(total, language),
    reasons: totalByKey(formRows, "reason").map(([reason, count]) => ({
      reason,
      labelKey: REASON_LABEL_KEYS[reason],
      count: formatNumber(count, language),
    })),
  };
}

function buildRejections(
  rows: readonly RejectionCount[],
  language: Language,
): RejectionsView {
  const total = rows.reduce((sum, { count }) => sum + count, 0);
  return {
    total: formatNumber(total, language),
    forms: totalByKey(rows, "form").map((entry) =>
      buildRejectionForm(entry, rows, language),
    ),
  };
}

export function buildOverviewView(
  { cards, activity, rejections }: OverviewData,
  options: ViewOptions,
): OverviewView {
  const { language } = options;
  return {
    cards: cards.map((card) => buildCard(card, options)),
    activity: mapLoaded(activity, (entries) =>
      entries.map((entry) => buildActivity(entry, language)),
    ),
    rejections: mapLoaded(rejections, (rows) =>
      buildRejections(rows, language),
    ),
  };
}
