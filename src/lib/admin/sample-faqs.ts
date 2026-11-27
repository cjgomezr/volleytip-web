import type { Language } from "../i18n/languages";
import {
  MAX_FAQ_ANSWER_LENGTH,
  MAX_FAQ_QUESTION_LENGTH,
  type FaqEditorView,
  type FaqListView,
  type FaqSaveOutcome,
} from "./faqs";

// Los datos de muestra de las preguntas del panel (/dev/preguntas), para
// capturar cada estado en Playwright sin sesión ni base. Son fijos.

export const SAMPLE_FAQ_STATES = [
  "lista",
  "vacia",
  "editor",
  "errores",
] as const;

export type SampleFaqState = (typeof SAMPLE_FAQ_STATES)[number];

export type SampleFaqs =
  | { readonly screen: "list"; readonly view: FaqListView }
  | {
      readonly screen: "editor";
      readonly view: FaqEditorView;
      readonly outcome?: FaqSaveOutcome;
    };

const NAMES: Readonly<Record<Language, readonly [string, string]>> = {
  es: ["español", "inglés"],
  en: ["Spanish", "English"],
};

function listedLanguages(
  language: Language,
  hasEnglish: boolean,
): FaqListView["rows"][number]["languages"] {
  const [spanish, english] = NAMES[language];
  return [
    { code: "es", name: spanish, isDefault: true, isTranslated: true },
    { code: "en", name: english, isDefault: false, isTranslated: hasEnglish },
  ];
}

const ROWS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    status: "published",
    question: "¿Hacen envíos fuera de Colombia?",
    hasEnglish: false,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    status: "published",
    question: "¿Cómo me inscribo en un Volleyball Camp?",
    hasEnglish: true,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    status: "draft",
    question:
      "¿Qué talla de camiseta elijo si estoy entre dos medidas y la quiero holgada para entrenar?",
    hasEnglish: false,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    status: "retired",
    question: "¿Cuándo sale la aplicación?",
    hasEnglish: true,
  },
] as const;

function buildList(language: Language): FaqListView {
  return {
    createdId: null,
    rows: ROWS.map(({ hasEnglish, ...row }) => ({
      ...row,
      questionLanguage: "es",
      languages: listedLanguages(language, hasEnglish),
    })),
  };
}

const SPANISH_TEXT = {
  question: "¿Hacen envíos fuera de Colombia?",
  answer:
    "Por ahora solo enviamos dentro de Colombia.\n\nSi estás en otro país, escríbenos desde Contacto y te avisamos cuando abramos.",
} as const;

const EDITOR: FaqEditorView = {
  faqId: ROWS[0].id,
  status: "published",
  languages: [
    { code: "es", name: "Español", isDefault: true, isTranslated: true },
    { code: "en", name: "English", isDefault: false, isTranslated: false },
  ],
  texts: { es: SPANISH_TEXT },
  limits: {
    question: MAX_FAQ_QUESTION_LENGTH,
    answer: MAX_FAQ_ANSWER_LENGTH,
  },
};

// Los dos idiomas con algo marcado: la pregunta en español demasiado larga y
// la traducción al inglés a medias.
const REJECTED: FaqSaveOutcome = {
  status: "invalid",
  formError: null,
  values: {
    "question:es": `${SPANISH_TEXT.question} ${"Y también a las islas. ".repeat(9)}`,
    "answer:es": SPANISH_TEXT.answer,
    "question:en": "Do you ship outside Colombia?",
    "answer:en": "",
  },
  fieldErrors: { "question:es": "tooLong", "answer:en": "required" },
};

export function buildSampleFaqs(
  state: SampleFaqState,
  language: Language,
): SampleFaqs {
  switch (state) {
    case "lista":
      return { screen: "list", view: buildList(language) };
    case "vacia":
      return { screen: "list", view: { rows: [], createdId: null } };
    case "editor":
      return { screen: "editor", view: EDITOR };
    case "errores":
      return { screen: "editor", view: EDITOR, outcome: REJECTED };
  }
}
