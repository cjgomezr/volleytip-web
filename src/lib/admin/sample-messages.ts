import type { Language } from "../i18n/languages";
import type { InboxRowView, InboxView, MessageView } from "./messages";

// Los datos de la página de muestra de la bandeja (/dev/mensajes). Son fijos:
// las capturas no pueden depender de la base ni del reloj.

export const SAMPLE_MESSAGES_STATES = [
  "lista",
  "vacia",
  "sin-resultados",
  "detalle-pedido",
  "detalle-marcas",
] as const;

export type SampleMessagesState = (typeof SAMPLE_MESSAGES_STATES)[number];

export type SampleMessages =
  | { readonly screen: "inbox"; readonly view: InboxView }
  | { readonly screen: "message"; readonly view: MessageView };

const DATES: Readonly<
  Record<Language, { readonly short: string; readonly long: string }>
> = {
  es: {
    short: "26/11/26, 10:30 a. m.",
    long: "26 de noviembre de 2026, 10:30",
  },
  en: { short: "11/26/26, 10:30 AM", long: "November 26, 2026 at 10:30 AM" },
};
const SAMPLE_DATE_TIME = "2026-11-26T15:30:00Z";

const ROWS = [
  {
    id: "1",
    name: "Laura Restrepo",
    excerpt:
      "Hola, no me ha llegado la guía de mi pedido y ya pasó una semana.",
    reason: "order",
    status: "new",
  },
  {
    id: "2",
    name: "Club Deportivo Voleibol del Valle de Aburrá y sus alrededores",
    excerpt:
      "Somos un club con unos 80 jugadores entre 12 y 18 años. Queremos organizar un Volleyball Camp en marzo. ¿Qué necesitamos y cuánto cuesta?",
    reason: "camps",
    status: "new",
  },
  {
    id: "3",
    name: "Marca de Ejemplo",
    excerpt:
      "https://ejemplo.test/una-direccion-muy-larga-sin-espacios-para-ver-el-corte",
    reason: "brands",
    status: "answered",
  },
  {
    id: "4",
    name: "Santiago",
    excerpt: "Un tip sobre la recepción, por favor.",
    reason: "suggest_tip",
    status: "archived",
  },
] as const;

const NO_FILTERS = {
  reason: null,
  status: null,
  search: "",
  page: 1,
} as const;

function buildInbox(
  language: Language,
  detailHref: string,
  overrides: Partial<InboxView> = {},
): SampleMessages {
  const rows: readonly InboxRowView[] = ROWS.map((row) => ({
    ...row,
    href: `${detailHref}&fila=${row.id}`,
    dateTime: SAMPLE_DATE_TIME,
    date: DATES[language].short,
  }));
  return {
    screen: "inbox",
    view: {
      query: NO_FILTERS,
      rows,
      total: 120,
      page: 2,
      pageCount: 3,
      previousHref: detailHref,
      nextHref: detailHref,
      ...overrides,
    },
  };
}

const EMPTY = {
  rows: [],
  total: 0,
  page: 1,
  pageCount: 1,
  previousHref: null,
  nextHref: null,
} as const;

function buildDetail(
  language: Language,
  overrides: Partial<MessageView>,
): SampleMessages {
  return {
    screen: "message",
    view: {
      id: "1",
      name: "Laura Restrepo",
      email: "laura.restrepo@ejemplo.test",
      reason: "order",
      status: "new",
      country: "Colombia",
      language: "Español",
      dateTime: SAMPLE_DATE_TIME,
      date: DATES[language].long,
      fields: [
        {
          id: "orderNumber",
          labelKey: "panel.messages.field.orderNumber",
          value: "VT-1042",
        },
      ],
      body: "Hola,\n\nNo me ha llegado la guía de mi pedido y ya pasó una semana.\n<b>Gracias</b>, quedo atenta.",
      privacyVersion: "2026-11",
      whatsapp: {
        number: "+57 300 000 0000",
        href: "https://wa.me/573000000000",
      },
      mailHref: "mailto:laura.restrepo@ejemplo.test",
      answer: null,
      notice: null,
      ...overrides,
    },
  };
}

function buildBrandsDetail(language: Language): SampleMessages {
  return buildDetail(language, {
    name: "Marca de Ejemplo con un nombre bastante largo",
    email: "colaboraciones.y.patrocinios@una-marca-de-ejemplo.test",
    reason: "brands",
    status: "answered",
    fields: [
      {
        id: "brand",
        labelKey: "panel.messages.field.brand",
        value: "Marca de Ejemplo",
      },
    ],
    body: "Nos interesa una colaboración.\nhttps://ejemplo.test/una-direccion-muy-larga-sin-espacios-para-ver-el-corte-de-linea",
    whatsapp: null,
    answer: {
      by: "Andrés Gómez",
      dateTime: SAMPLE_DATE_TIME,
      date: DATES[language].long,
    },
    notice: "answered",
  });
}

/** Un estado de la muestra. `detailHref` es a donde llevan sus enlaces. */
export function buildSampleMessages(
  state: SampleMessagesState,
  language: Language,
  detailHref: string,
): SampleMessages {
  switch (state) {
    case "lista":
      return buildInbox(language, detailHref);
    case "vacia":
      return buildInbox(language, detailHref, EMPTY);
    case "sin-resultados":
      return buildInbox(language, detailHref, {
        ...EMPTY,
        query: {
          reason: "brands",
          status: "new",
          search: "nadie@ejemplo.test",
          page: 1,
        },
      });
    case "detalle-pedido":
      return buildDetail(language, {});
    case "detalle-marcas":
      return buildBrandsDetail(language);
  }
}
