import type { ReactElement } from "react";

import { CONTACT_REASON_PARAM } from "~/lib/contact-link";
import {
  resolveContactReason,
  type ContactReasonId,
} from "~/lib/contact-reasons";
import { readFaqs, type Faq } from "~/lib/faqs.server";
import {
  CONTACT_FORM,
  handleContactSubmission,
} from "~/lib/forms/contact-form.server";
import {
  issueFormProtection,
  type FormProtectionFields,
} from "~/lib/forms/protected-form.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";

import type { Route } from "./+types/contact";
import { ContactPage } from "./contact-page";

/** Cuántas preguntas frecuentes caben en la columna lateral. */
const SIDEBAR_FAQ_LIMIT = 3;

export interface ContactLoaderData {
  readonly title: string;
  readonly description: string;
  readonly language: Language;
  readonly reason: ContactReasonId;
  readonly faqs: readonly Faq[];
  readonly protection: FormProtectionFields;
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<ContactLoaderData> {
  const language = getRequestLanguage(request);
  const translate = getTranslate(language);
  const { searchParams } = new URL(request.url);
  return {
    title: translate("contact.title"),
    description: translate("contact.description"),
    language,
    reason: resolveContactReason(searchParams.get(CONTACT_REASON_PARAM)),
    faqs: await readFaqs(language, { limit: SIDEBAR_FAQ_LIMIT }),
    protection: issueFormProtection(CONTACT_FORM),
  };
}

export function action({
  request,
}: Route.ActionArgs): ReturnType<typeof handleContactSubmission> {
  return handleContactSubmission(request);
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function Contact({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <ContactPage
      reason={loaderData.reason}
      language={loaderData.language}
      faqs={loaderData.faqs}
      protection={loaderData.protection}
      outcome={actionData}
    />
  );
}
