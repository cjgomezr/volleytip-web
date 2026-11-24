import type { ReactElement } from "react";
import { data } from "react-router";

import { serverEnv } from "~/lib/env.server";
import type { Faq } from "~/lib/faqs.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";

import type { Route } from "./+types/dev-faq";
import { FaqPage } from "./faq-page";

// Pinta la página de preguntas frecuentes sin tocar la base, para capturarla
// en Playwright: con preguntas de muestra por omisión y vacía con
// `?estado=vacia`. En producción responde 404.
const NOT_FOUND_STATUS = 404;

const SAMPLE_FAQS: readonly Faq[] = [
  {
    id: "dev-1",
    question: "¿Los tips son gratis?",
    questionLanguage: "es",
    answer:
      "Sí. Todos los videos de tips son gratis.\nLos camps y la tienda tienen su propio precio.",
    answerLanguage: "es",
  },
  {
    id: "dev-2",
    question: "¿Cómo me inscribo a un camp?",
    questionLanguage: "es",
    answer: "Desde la página de Camps, con el pago en línea.",
    answerLanguage: "es",
  },
  {
    id: "dev-3",
    question: "¿Puedo pedir desde otro país?",
    questionLanguage: "es",
    answer: "Sí, enviamos a varios países. <b>Escríbenos</b> si dudas.",
    answerLanguage: "es",
  },
];

const ENGLISH_SAMPLE_FAQS: readonly Faq[] = [
  {
    id: "dev-1",
    question: "Are the tips free?",
    questionLanguage: "en",
    answer:
      "Yes. Every tip video is free.\nCamps and the shop have their own price.",
    answerLanguage: "en",
  },
  // Sin traducción de la respuesta: sale la respuesta en español.
  {
    id: "dev-2",
    question: "How do I sign up for a camp?",
    questionLanguage: "en",
    answer: "Desde la página de Camps, con el pago en línea.",
    answerLanguage: "es",
  },
  {
    id: "dev-3",
    question: "Can I order from another country?",
    questionLanguage: "en",
    answer: "Yes, we ship to several countries. <b>Write to us</b> if unsure.",
    answerLanguage: "en",
  },
];

export function loader({ request }: Route.LoaderArgs): {
  readonly faqs: readonly Faq[];
  readonly language: Language;
} {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const language = getRequestLanguage(request);
  const params = new URL(request.url).searchParams;
  if (params.get("estado") === "vacia") return { faqs: [], language };
  return {
    faqs: language === "en" ? ENGLISH_SAMPLE_FAQS : SAMPLE_FAQS,
    language,
  };
}

export default function DevFaq({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <FaqPage {...loaderData} />;
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Preguntas frecuentes · VolleyTip (muestra)" },
    { name: "robots", content: "noindex" },
  ];
}
