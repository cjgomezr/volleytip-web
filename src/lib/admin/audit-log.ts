import type { Json } from "../database.types";
import { formatDate, formatNumber } from "../i18n/format";
import type { Language } from "../i18n/languages";
import {
  buildAuditSearch,
  hasFilters,
  isRangeInverted,
  type AuditFilterOptions,
  type AuditFilters,
} from "./audit-filters";

/** Una entrada como la lista la lee de la base. */
export interface AuditRecord {
  readonly id: string;
  readonly action: string;
  readonly entity: string;
  readonly createdAt: string;
  /** Nulo cuando la acción no la hizo una persona. */
  readonly actorName: string | null;
}

/** Una entrada con todo lo que guardó. */
export interface AuditEntryRecord extends AuditRecord {
  readonly entityId: string | null;
  readonly details: Json;
}

/** Una página de la bitácora, sin formato. */
export interface AuditPage {
  readonly entries: readonly AuditRecord[];
  readonly options: AuditFilterOptions;
  readonly filters: AuditFilters;
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
}

export interface AuditEntryRowView {
  readonly id: string;
  readonly action: string;
  readonly entity: string;
  readonly actorName: string | null;
  /** La fecha para `<time>`. */
  readonly dateTime: string;
  readonly date: string;
  /** A dónde lleva su detalle. */
  readonly href: string;
}

export interface AuditPaginationView {
  readonly page: number;
  readonly pageCount: number;
  readonly total: string;
  readonly previousHref?: string;
  readonly nextHref?: string;
}

/** La lista lista para pintar. Fechas y números salen del servidor ya en el
 * idioma del panel. */
export interface AuditListView {
  /** `inverted`: la fecha final es anterior a la inicial. */
  readonly state: "entries" | "empty" | "inverted";
  readonly entries: readonly AuditEntryRowView[];
  readonly options: AuditFilterOptions;
  readonly filters: AuditFilters;
  readonly isFiltered: boolean;
  readonly pagination: AuditPaginationView;
  /** La lista sin filtros. */
  readonly clearHref: string;
}

/** Un valor del antes o el después, siempre como texto. */
export type AuditValue =
  | { readonly kind: "text"; readonly text: string }
  /** Un texto vacío. */
  | { readonly kind: "empty" }
  /** El campo no existía: en una creación, el antes. */
  | { readonly kind: "absent" };

export interface AuditChangeView {
  readonly field: string;
  readonly before: AuditValue;
  readonly after: AuditValue;
}

export interface AuditFieldView {
  readonly field: string;
  readonly value: AuditValue;
}

export interface AuditEntryView {
  readonly action: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly actorName: string | null;
  readonly dateTime: string;
  readonly date: string;
  /** Campo por campo, lo que la acción cambió. */
  readonly changes: readonly AuditChangeView[];
  /** Lo demás que guardó la entrada, como la clave de lo cambiado. */
  readonly extras: readonly AuditFieldView[];
  /** La lista, con los filtros y la página de donde se vino. */
  readonly backHref: string;
}

export interface AuditListLinks {
  /** La dirección de la lista, sin búsqueda. */
  readonly listPath: string;
  readonly buildEntryHref: (id: string, search: string) => string;
}

function formatMoment(createdAt: string, language: Language): string {
  return formatDate(new Date(createdAt), language, {
    style: "short",
    withTime: true,
  });
}

function buildPagination(
  { filters, page, pageCount, total }: AuditPage,
  listPath: string,
  language: Language,
): AuditPaginationView {
  const hrefOf = (target: number): string =>
    `${listPath}${buildAuditSearch(filters, target)}`;
  return {
    page,
    pageCount,
    total: formatNumber(total, language),
    previousHref: page > 1 ? hrefOf(page - 1) : undefined,
    nextHref: page < pageCount ? hrefOf(page + 1) : undefined,
  };
}

function describeState({
  filters,
  entries,
}: AuditPage): AuditListView["state"] {
  if (isRangeInverted(filters)) return "inverted";
  return entries.length === 0 ? "empty" : "entries";
}

export function buildAuditListView(
  data: AuditPage,
  { language, links }: { language: Language; links: AuditListLinks },
): AuditListView {
  const search = buildAuditSearch(data.filters, data.page);
  return {
    state: describeState(data),
    entries: data.entries.map(({ createdAt, ...entry }) => ({
      ...entry,
      dateTime: createdAt,
      date: formatMoment(createdAt, language),
      href: links.buildEntryHref(entry.id, search),
    })),
    options: data.options,
    filters: data.filters,
    isFiltered: hasFilters(data.filters),
    pagination: buildPagination(data, links.listPath, language),
    clearHref: links.listPath,
  };
}

type JsonObject = Readonly<Record<string, Json | undefined>>;

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValue(value: Json | undefined): AuditValue {
  if (value === undefined) return { kind: "absent" };
  if (value === "") return { kind: "empty" };
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { kind: "text", text };
}

// La forma que escribe `defineAdminAction`: `before` y `after` son objetos, o
// nulos en una creación o un borrado. Otra cosa se muestra como un dato más.
function isSnapshot(value: Json | undefined): value is JsonObject | null {
  return value === null || isJsonObject(value);
}

function describeChanges(
  before: JsonObject | null,
  after: JsonObject | null,
): readonly AuditChangeView[] {
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  return [...fields].map((field) => ({
    field,
    before: describeValue(before?.[field]),
    after: describeValue(after?.[field]),
  }));
}

function describeFields(fields: JsonObject): readonly AuditFieldView[] {
  return Object.entries(fields).map(([field, value]) => ({
    field,
    value: describeValue(value),
  }));
}

function splitDetails(
  details: Json,
): Pick<AuditEntryView, "changes" | "extras"> {
  const all: JsonObject = isJsonObject(details) ? details : { value: details };
  const { before, after, ...rest } = all;
  if (
    !isSnapshot(before) ||
    !isSnapshot(after) ||
    (before === null && after === null)
  ) {
    return { changes: [], extras: describeFields(all) };
  }
  return {
    changes: describeChanges(before, after),
    extras: describeFields(rest),
  };
}

export function buildAuditEntryView(
  entry: AuditEntryRecord,
  { language, backHref }: { language: Language; backHref: string },
): AuditEntryView {
  const { action, entity, entityId, actorName, createdAt, details } = entry;
  return {
    action,
    entity,
    entityId,
    actorName,
    dateTime: createdAt,
    date: formatMoment(createdAt, language),
    ...splitDetails(details),
    backHref,
  };
}
