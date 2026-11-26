import type { Language } from "../i18n/languages";
import type { AdminModule } from "./modules";
import {
  APP_WAITLIST_CARD,
  buildOverviewView,
  CAMP_NOTIFY_CARD,
  NEW_MESSAGES_CARD,
  type ActivityEntry,
  type CardData,
  type Loaded,
  type OverviewData,
  type OverviewView,
  type RejectionCount,
} from "./overview";
import { SAMPLE_MODULES } from "./sample-modules";

// El resumen de la página de muestra (/dev/panel?resumen=...): sin sesión ni
// base, con fechas fijas para que las capturas no cambien.

/** Con datos y la bandeja registrada, sin nada, o con consultas que fallan. */
export const SAMPLE_OVERVIEW_STATES = ["datos", "vacio", "fallo"] as const;
export type SampleOverviewState = (typeof SAMPLE_OVERVIEW_STATES)[number];

// La muestra de la bandeja, con el id que tendrá su módulo.
const SAMPLE_MESSAGES_MODULES: readonly AdminModule[] = SAMPLE_MODULES.filter(
  ({ id }) => id === "sample-messages",
).map((module) => ({ ...module, id: "messages" }));

const SAMPLE_ACTIONS: readonly (readonly [string, string | null])[] = [
  ["message.answer", "Andrés Gómez"],
  ["announcement_bar.update", "camilo.administrador@volleytip.example"],
  ["form_rejections.purge", null],
  ["faq.publish", "Andrés Gómez"],
  ["faq.update", "Andrés Gómez"],
  ["team_member.invite", "Camilo"],
  ["market.update", "Camilo"],
  ["site_text.update", "Andrés Gómez"],
  ["message.archive", "Andrés Gómez"],
  ["profile.promote", null],
];

const SAMPLE_ACTIVITY: readonly ActivityEntry[] = SAMPLE_ACTIONS.map(
  ([action, actorName], index) => ({
    id: `sample-entry-${index}`,
    action,
    actorName,
    createdAt: `2026-11-${25 - index}T19:30:00Z`,
  }),
);

const SAMPLE_REJECTIONS: readonly RejectionCount[] = [
  { form: "contact", reason: "turnstile", count: 1240 },
  { form: "contact", reason: "honeypot", count: 18 },
  { form: "app_waitlist", reason: "rate_limit", count: 6 },
  { form: "camp_notify", reason: "too_fast", count: 2 },
  { form: "admin_sign_in", reason: "validation", count: 1 },
];

function sampleCards(
  messages: Loaded<number>,
  app: Loaded<number>,
  camps: Loaded<number>,
): readonly CardData[] {
  return [
    { ...NEW_MESSAGES_CARD, count: messages },
    { ...APP_WAITLIST_CARD, count: app },
    { ...CAMP_NOTIFY_CARD, count: camps },
  ];
}

function ok<Value>(value: Value): Loaded<Value> {
  return { status: "ok", value };
}

const SAMPLE_DATA: Readonly<Record<SampleOverviewState, OverviewData>> = {
  datos: {
    cards: sampleCards(ok(3), ok(12840), ok(112)),
    activity: ok(SAMPLE_ACTIVITY),
    rejections: ok(SAMPLE_REJECTIONS),
  },
  vacio: {
    cards: sampleCards(ok(0), ok(0), ok(0)),
    activity: ok([]),
    rejections: ok([]),
  },
  fallo: {
    cards: sampleCards({ status: "failed" }, ok(12840), ok(112)),
    activity: { status: "failed" },
    rejections: { status: "failed" },
  },
};

export function buildSampleOverview(
  state: SampleOverviewState,
  language: Language,
): OverviewView {
  return buildOverviewView(SAMPLE_DATA[state], {
    modules: state === "vacio" ? [] : SAMPLE_MESSAGES_MODULES,
    language,
  });
}
