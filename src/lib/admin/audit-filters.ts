// Los filtros y la página de la bitácora, que viven en la dirección. Un valor
// que no sirve se ignora: la pantalla nunca falla por una dirección mal
// escrita.

/** Los nombres con que van en la dirección, iguales en los dos idiomas. */
export const AUDIT_PARAMS = {
  actorId: "persona",
  action: "accion",
  fromDay: "desde",
  toDay: "hasta",
  page: "pagina",
} as const;

// Hasta nueve cifras: más no es una página, y no cabría como posición.
const PAGE_NUMBER = /^[1-9]\d{0,8}$/;
// El año no empieza en cero: la base no tiene año 0.
const ISO_DAY = /^[1-9]\d{3}-\d{2}-\d{2}$/;

export interface AuditActor {
  readonly id: string;
  readonly name: string;
}

/** Entre qué se puede elegir: solo lo que aparece en la bitácora. */
export interface AuditFilterOptions {
  readonly actors: readonly AuditActor[];
  readonly actions: readonly string[];
}

export interface AuditFilters {
  readonly actorId: string | null;
  readonly action: string | null;
  /** Días como `2026-11-24`, en la hora de Colombia, ambos incluidos. */
  readonly fromDay: string | null;
  readonly toDay: string | null;
}

// `2026-02-30` tiene la forma, pero `Date` lo corre a marzo.
function isCalendarDay(day: string): boolean {
  if (!ISO_DAY.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

function readValid(
  params: URLSearchParams,
  name: string,
  isValid: (value: string) => boolean,
): string | null {
  const value = params.get(name);
  return value !== null && isValid(value) ? value : null;
}

export function parseAuditFilters(
  params: URLSearchParams,
  { actors, actions }: AuditFilterOptions,
): AuditFilters {
  return {
    actorId: readValid(params, AUDIT_PARAMS.actorId, (value) =>
      actors.some(({ id }) => id === value),
    ),
    action: readValid(params, AUDIT_PARAMS.action, (value) =>
      actions.includes(value),
    ),
    fromDay: readValid(params, AUDIT_PARAMS.fromDay, isCalendarDay),
    toDay: readValid(params, AUDIT_PARAMS.toDay, isCalendarDay),
  };
}

/** La página pedida. Todavía puede pasarse del final de la lista. */
export function parseAuditPage(params: URLSearchParams): number {
  const value = params.get(AUDIT_PARAMS.page) ?? "";
  return PAGE_NUMBER.test(value) ? Number(value) : 1;
}

export function isRangeInverted({ fromDay, toDay }: AuditFilters): boolean {
  return fromDay !== null && toDay !== null && toDay < fromDay;
}

export function hasFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

/** La parte de una búsqueda que es de la lista: lo demás que traiga la
 * dirección no vuelve con la persona. */
export function keepAuditSearch(params: URLSearchParams): string {
  const names: readonly string[] = Object.values(AUDIT_PARAMS);
  const kept = new URLSearchParams(
    [...params].filter(([name]) => names.includes(name)),
  ).toString();
  return kept === "" ? "" : `?${kept}`;
}

/** La búsqueda de una dirección con esos filtros y esa página: `""` o
 * `?accion=faq.publish&pagina=2`. */
export function buildAuditSearch(filters: AuditFilters, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["actorId", "action", "fromDay", "toDay"] as const) {
    const value = filters[key];
    if (value !== null) params.set(AUDIT_PARAMS[key], value);
  }
  if (page > 1) params.set(AUDIT_PARAMS.page, String(page));
  const search = params.toString();
  return search === "" ? "" : `?${search}`;
}
