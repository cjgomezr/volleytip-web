import type { ReactElement } from "react";

import { getContactPath } from "~/lib/contact-link";
import type { Faq } from "~/lib/faqs.server";
import type { Language } from "~/lib/i18n/languages";
import type { PageDeclaration } from "~/lib/i18n/page-path";
import { PAGES } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";

interface FaqPageProps {
  readonly faqs: readonly Faq[];
  readonly language: Language;
  /** El mapa de páginas donde se busca Contacto. Solo las pruebas lo cambian. */
  readonly pages?: readonly PageDeclaration[];
}

const MAX_CONTENT_STYLES = "mx-auto max-w-[1280px] px-6";

// Un campo que cayó al español dentro de una página en inglés se marca para
// que el lector de pantalla lo pronuncie bien.
function langFor(
  fieldLanguage: Language,
  pageLanguage: Language,
): Language | undefined {
  return fieldLanguage === pageLanguage ? undefined : fieldLanguage;
}

function FaqItem({
  faq,
  pageLanguage,
}: {
  readonly faq: Faq;
  readonly pageLanguage: Language;
}): ReactElement {
  return (
    <details className="border-b border-brand-indigo py-4">
      <summary
        lang={langFor(faq.questionLanguage, pageLanguage)}
        className="min-h-11 cursor-pointer text-[18px] font-bold text-brand-mist"
      >
        {faq.question}
      </summary>
      <p
        lang={langFor(faq.answerLanguage, pageLanguage)}
        className="mt-2.5 mb-0 whitespace-pre-line text-ink-muted"
      >
        {faq.answer}
      </p>
    </details>
  );
}

function ContactPrompt({
  contactPath,
}: {
  readonly contactPath: string | undefined;
}): ReactElement | null {
  const translate = useTranslate();
  if (contactPath === undefined) return null;
  return (
    <p className="mt-8 mb-0 text-ink-muted">
      {translate("faq.contact.text")}
      <a
        href={contactPath}
        className="font-bold text-brand-lime underline focused:outline-brand-lime"
      >
        {translate("faq.contact.link")}
      </a>
    </p>
  );
}

/** La página de preguntas frecuentes (FR-137). */
export function FaqPage({
  faqs,
  language,
  pages = PAGES,
}: FaqPageProps): ReactElement {
  const translate = useTranslate();

  return (
    <section className={`${MAX_CONTENT_STYLES} pt-16 pb-24 md:pt-24`}>
      <p className="m-0 text-[14px] font-bold tracking-[0.12em] text-brand-lime uppercase">
        {translate("faq.eyebrow")}
      </p>
      <h1 className="mt-4 mb-8 font-display text-[48px] leading-[1] font-normal uppercase md:text-[80px]">
        {translate("faq.heading")}
      </h1>
      {faqs.length === 0 ? (
        <p className="m-0 max-w-[640px] text-[18px] text-ink-muted">
          {translate("faq.empty.text")}
        </p>
      ) : (
        <div className="border-t-2 border-brand-indigo">
          {faqs.map((faq) => (
            <FaqItem key={faq.id} faq={faq} pageLanguage={language} />
          ))}
        </div>
      )}
      <ContactPrompt contactPath={getContactPath(pages, language)} />
    </section>
  );
}
