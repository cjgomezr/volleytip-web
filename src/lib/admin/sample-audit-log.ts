import type { Language } from "../i18n/languages";
import type { AuditFilters } from "./audit-filters";
import {
  buildAuditEntryView,
  buildAuditListView,
  type AuditEntryRecord,
  type AuditEntryView,
  type AuditListView,
  type AuditPage,
} from "./audit-log";

// La bitácora de la página de muestra (/dev/panel/bitacora?bitacora=...): sin
// sesión ni base, con fechas fijas para que las capturas no cambien.

export const SAMPLE_AUDIT_STATES = [
  "datos",
  "vacio",
  "rango",
  "detalle",
] as const;
export type SampleAuditState = (typeof SAMPLE_AUDIT_STATES)[number];

export type SampleAuditLog =
  | { readonly screen: "list"; readonly view: AuditListView }
  | { readonly screen: "entry"; readonly view: AuditEntryView };

const LONG_EMAIL = "camilo.administrador@volleytip.example";

const SAMPLE_ENTRY: AuditEntryRecord = {
  id: "sample-entry-0",
  action: "announcement_bar.update",
  entity: "announcement_bar",
  entityId: null,
  actorName: "Andrés Gómez",
  createdAt: "2026-11-25T19:30:00Z",
  details: {
    key: "announcement_bar",
    before: {
      messages: [{ es: "Volleyball Camp · próximamente", en: "" }],
      note: "",
    },
    after: {
      messages: [
        { es: "Envío gratis en Colombia", en: "Free shipping in Colombia" },
      ],
      note: "<strong>El HTML se lee como texto</strong> https://volleytip.example/una-direccion-muy-larga-que-no-tiene-donde-partirse",
    },
  },
};

const SAMPLE_ACTIONS: readonly (readonly [string, string, string | null])[] = [
  ["announcement_bar.update", "announcement_bar", "Andrés Gómez"],
  ["maintenance_mode.update", "maintenance_mode", LONG_EMAIL],
  ["profile.grant_admin", "profile", null],
  ["site_text.update", "site_text", "Andrés Gómez"],
  ["app_availability.update", "app_availability", "Camilo"],
  ["profile.set_locale", "profile", "Camilo"],
];

const NO_FILTERS: AuditFilters = {
  actorId: null,
  action: null,
  fromDay: null,
  toDay: null,
};

const SAMPLE_PAGE: AuditPage = {
  entries: SAMPLE_ACTIONS.map(([action, entity, actorName], index) => ({
    id: `sample-entry-${index}`,
    action,
    entity,
    actorName,
    createdAt: `2026-11-${25 - index}T19:30:00Z`,
  })),
  options: {
    actors: [
      { id: "sample-andres", name: "Andrés Gómez" },
      { id: "sample-camilo", name: LONG_EMAIL },
    ],
    actions: SAMPLE_ACTIONS.map(([action]) => action),
  },
  filters: NO_FILTERS,
  page: 2,
  pageCount: 200,
  total: 10000,
};

const NOTHING = { entries: [], page: 1, pageCount: 1, total: 0 } as const;

const SAMPLE_LISTS: Readonly<
  Record<Exclude<SampleAuditState, "detalle">, AuditPage>
> = {
  datos: SAMPLE_PAGE,
  vacio: {
    ...SAMPLE_PAGE,
    ...NOTHING,
    filters: { ...NO_FILTERS, actorId: "sample-andres" },
  },
  rango: {
    ...SAMPLE_PAGE,
    ...NOTHING,
    filters: { ...NO_FILTERS, fromDay: "2026-11-24", toDay: "2026-11-01" },
  },
};

export function buildSampleAuditLog(
  state: SampleAuditState,
  { language, listPath }: { language: Language; listPath: string },
): SampleAuditLog {
  if (state === "detalle") {
    const view = buildAuditEntryView(SAMPLE_ENTRY, {
      language,
      backHref: `${listPath}?bitacora=datos`,
    });
    return { screen: "entry", view };
  }
  const view = buildAuditListView(SAMPLE_LISTS[state], {
    language,
    links: { listPath, buildEntryHref: () => `${listPath}?bitacora=detalle` },
  });
  return { screen: "list", view };
}
