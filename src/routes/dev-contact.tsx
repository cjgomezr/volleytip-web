import type { ReactElement } from "react";
import { data } from "react-router";

import { CONTACT_REASON_PARAM } from "~/lib/contact-link";
import {
  resolveContactReason,
  type ContactReasonId,
} from "~/lib/contact-reasons";
import { serverEnv } from "~/lib/env.server";
import type { Faq } from "~/lib/faqs.server";
import {
  CONTACT_ERROR_KEYS,
  CONTACT_FORM,
  type ContactOutcome,
} from "~/lib/forms/contact-form.server";
import {
  issueFormProtection,
  type FormProtectionFields,
} from "~/lib/forms/protected-form.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";

import type { Route } from "./+types/dev-contact";
import { ContactPage } from "./contact-page";

// Pinta la página de contacto sin tocar la base, para capturarla en
// Playwright: `?motivo=pedido|camps|marcas|tip|otro` y
// `?resultado=enviado|invalido|rechazado`. Solo pinta: no recibe envíos, que
// son de /contacto. En producción responde 404.
const NOT_FOUND_STATUS = 404;

const SAMPLE_FAQS: readonly Faq[] = [
  {
    id: "dev-1",
    question: "¿Cuánto tarda mi envío?",
    questionLanguage: "es",
    answer: "Entre 2 y 5 días hábiles.",
    answerLanguage: "es",
  },
  {
    id: "dev-2",
    question: "¿Cómo cambio la talla?",
    questionLanguage: "es",
    answer: "Escríbenos con tu número de pedido.",
    answerLanguage: "es",
  },
  {
    id: "dev-3",
    question: "¿Qué incluye un camp?",
    questionLanguage: "es",
    answer: "Entrenamiento, hidratación y fotos.",
    answerLanguage: "es",
  },
];

const OUTCOMES: Readonly<Record<string, ContactOutcome>> = {
  enviado: { status: "sent" },
  invalido: {
    status: "invalid",
    fieldErrors: {
      email: CONTACT_ERROR_KEYS.emailInvalid,
      orderNumber: CONTACT_ERROR_KEYS.orderNumberRequired,
      message: CONTACT_ERROR_KEYS.messageRequired,
    },
    values: { name: "Ana Pérez", email: "ana@", country: "MX" },
  },
  rechazado: { status: "rejected", reason: "rate_limited" },
};

export function loader({ request }: Route.LoaderArgs): {
  readonly language: Language;
  readonly reason: ContactReasonId;
  readonly faqs: readonly Faq[];
  readonly outcome: ContactOutcome | undefined;
  readonly protection: FormProtectionFields;
} {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const params = new URL(request.url).searchParams;
  return {
    language: getRequestLanguage(request),
    reason: resolveContactReason(params.get(CONTACT_REASON_PARAM)),
    faqs: SAMPLE_FAQS,
    outcome: OUTCOMES[params.get("resultado") ?? ""],
    protection: issueFormProtection(CONTACT_FORM),
  };
}

export default function DevContact({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <ContactPage {...loaderData} />;
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Contacto · VolleyTip (muestra)" },
    { name: "robots", content: "noindex" },
  ];
}
