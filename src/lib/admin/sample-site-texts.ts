// Los estados de "Textos del sitio" que pinta la página de muestra
// (/dev/panel/textos?textos=...), sin sesión ni base.
import { messageField, statField } from "./site-texts";
import type {
  LocalizedDraft,
  SiteTextsLimits,
  SiteTextsView,
  BarOutcome,
  StatsOutcome,
} from "./site-texts";

export const SAMPLE_SITE_TEXTS_STATES = [
  "datos",
  "errores",
  "confirmacion",
  "invalido",
] as const;

export type SampleSiteTextsState = (typeof SAMPLE_SITE_TEXTS_STATES)[number];

export interface SampleSiteTexts extends SiteTextsView {
  readonly barOutcome?: BarOutcome;
  readonly statsOutcome?: StatsOutcome;
}

// El tercero sin inglés: así los datos enseñan también el aviso.
const MESSAGES: readonly LocalizedDraft[] = [
  { es: "En vivo: nuevo tip cada semana", en: "Live: a new tip every week" },
  { es: "Volleyball Camp · próximamente", en: "Volleyball Camp · coming soon" },
  { es: "Envío gratis en Colombia desde $200.000", en: "" },
];

const STATS: SiteTextsView["stats"] = [
  {
    id: "instagram",
    value: { es: "116K", en: "116K" },
    label: { es: "seguidores en Instagram", en: "Instagram followers" },
  },
  {
    id: "tiktok",
    value: { es: "530K", en: "530K" },
    label: { es: "seguidores en TikTok", en: "TikTok followers" },
  },
  {
    id: "views",
    value: { es: "Millones", en: "Millions" },
    label: {
      es: "de vistas en TikTok e Instagram",
      en: "of views on TikTok and Instagram",
    },
  },
  {
    id: "region",
    value: { es: "", en: "" },
    label: {
      es: "desde Colombia para toda Suramérica",
      en: "from Colombia to all of South America",
    },
  },
];

function buildRejected(
  limits: SiteTextsLimits,
): Pick<SampleSiteTexts, "barOutcome" | "statsOutcome"> {
  // Sin espacios: lo más difícil de acomodar en un celular.
  const longMessage = "x".repeat(limits.maxMessageLength + 1);
  const longValue = "9".repeat(limits.maxStatValueLength + 1);
  const field = statField("instagram", "value", "es");
  return {
    barOutcome: {
      status: "invalid",
      values: [
        { es: "", en: "Live: a new tip every week" },
        { es: longMessage, en: "" },
      ],
      fieldErrors: {
        [messageField(0, "es")]: "required",
        [messageField(1, "es")]: "tooLong",
      },
      formError: null,
    },
    statsOutcome: {
      status: "invalid",
      values: { [field]: longValue },
      fieldErrors: { [field]: "tooLong" },
    },
  };
}

/** La pantalla en el estado pedido. Los límites son los del sitio. */
export function buildSampleSiteTexts(
  state: SampleSiteTextsState,
  limits: SiteTextsLimits,
): SampleSiteTexts {
  const view: SiteTextsView = {
    bar: { messages: MESSAGES, invalidValue: null },
    stats: STATS,
    limits,
  };
  switch (state) {
    case "datos":
      return view;
    case "errores":
      return { ...view, ...buildRejected(limits) };
    case "confirmacion":
      return {
        ...view,
        barOutcome: { status: "saved" },
        statsOutcome: { status: "unchanged" },
      };
    case "invalido":
      return {
        ...view,
        bar: {
          messages: [],
          invalidValue: JSON.stringify(
            { texto: "esto no es una lista de mensajes" },
            null,
            2,
          ),
        },
      };
  }
}
