import type { ReactElement, ReactNode } from "react";

import {
  TEAM_EMAIL,
  TEAM_EMAIL_HREF,
  WHATSAPP_DISPLAY_NUMBER,
  WHATSAPP_HREF,
} from "~/lib/contact-channels";
import type { Faq } from "~/lib/faqs.server";
import type { Language } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";

import { LocalizedLink } from "./localized-link";

const CARD_STYLES =
  "flex items-center gap-4 rounded-card bg-brand-indigo p-5 text-brand-mist no-underline hovered:text-brand-lime";

function ChannelIcon({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-brand-mist text-brand-night"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

function ChannelCard({
  href,
  icon,
  title,
  note,
}: {
  readonly href: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly note: string;
}): ReactElement {
  return (
    <a href={href} className={CARD_STYLES}>
      <ChannelIcon>{icon}</ChannelIcon>
      <span className="min-w-0">
        <span className="block text-[18px] font-bold break-words">{title}</span>
        <span className="block text-ink-muted">{note}</span>
      </span>
    </a>
  );
}

function langFor(
  fieldLanguage: Language,
  pageLanguage: Language,
): Language | undefined {
  return fieldLanguage === pageLanguage ? undefined : fieldLanguage;
}

function QuickQuestions({
  faqs,
  language,
}: {
  readonly faqs: readonly Faq[];
  readonly language: Language;
}): ReactElement | null {
  const translate = useTranslate();
  if (faqs.length === 0) return null;
  return (
    <section
      aria-labelledby="contact-faq-heading"
      className="rounded-card border-2 border-brand-indigo p-5"
    >
      <h3 id="contact-faq-heading" className="m-0 text-[18px] font-bold">
        {translate("contact.faq.heading")}
      </h3>
      <p className="mt-2 mb-3.5 text-ink-muted">
        {translate("contact.faq.text")}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {faqs.map((faq) => (
          <li key={faq.id}>
            <LocalizedLink
              page="faq"
              lang={langFor(faq.questionLanguage, language)}
              className="inline-flex min-h-11 items-center font-semibold text-brand-mist underline hovered:text-brand-lime"
            >
              {faq.question} →
            </LocalizedLink>
          </li>
        ))}
      </ul>
      <p className="mt-3 mb-0">
        <LocalizedLink
          page="faq"
          className="font-bold text-brand-lime underline"
        >
          {translate("contact.faq.all")}
        </LocalizedLink>
      </p>
    </section>
  );
}

/** La columna lateral de Contacto: los canales directos y hasta tres
 * preguntas frecuentes. Sin preguntas publicadas, ese bloque no se pinta. */
export function ContactSidebar({
  faqs,
  language,
}: {
  readonly faqs: readonly Faq[];
  readonly language: Language;
}): ReactElement {
  const translate = useTranslate();
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <h2 className="m-0 text-[13px] font-bold tracking-[0.12em] uppercase">
        {translate("contact.channels.heading")}
      </h2>
      <ChannelCard
        href={WHATSAPP_HREF}
        icon={
          <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.3A8.5 8.5 0 1 1 21 12z" />
        }
        title={translate("contact.channels.whatsapp")}
        note={translate("contact.channels.whatsappNote", {
          number: WHATSAPP_DISPLAY_NUMBER,
        })}
      />
      <ChannelCard
        href={TEAM_EMAIL_HREF}
        icon={
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </>
        }
        title={TEAM_EMAIL}
        note={translate("contact.channels.emailNote")}
      />
      <QuickQuestions faqs={faqs} language={language} />
    </aside>
  );
}
