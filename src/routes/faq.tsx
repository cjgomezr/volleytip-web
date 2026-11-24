import type { ReactElement } from "react";

import { readFaqs, type Faq } from "~/lib/faqs.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";

import type { Route } from "./+types/faq";
import { FaqPage } from "./faq-page";

export interface FaqData {
  readonly title: string;
  readonly description: string;
  readonly language: Language;
  readonly faqs: readonly Faq[];
}

export async function loader({ request }: Route.LoaderArgs): Promise<FaqData> {
  const language = getRequestLanguage(request);
  const translate = getTranslate(language);
  return {
    title: translate("faq.title"),
    description: translate("faq.description"),
    language,
    faqs: await readFaqs(language),
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function Faq({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <FaqPage faqs={loaderData.faqs} language={loaderData.language} />;
}
