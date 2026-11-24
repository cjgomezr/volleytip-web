import { useMemo, type ReactElement } from "react";
import { Form, Link, useNavigation } from "react-router";

import { Button } from "~/components/button";
import { ContactSidebar } from "~/components/contact-sidebar";
import { FormProtection } from "~/components/form-protection";
import { LocalizedLink } from "~/components/localized-link";
import { SelectField } from "~/components/select-field";
import { TextAreaField } from "~/components/text-area-field";
import { TextField } from "~/components/text-field";
import { TEAM_EMAIL, WHATSAPP_DISPLAY_NUMBER } from "~/lib/contact-channels";
import { CONTACT_REASON_PARAM } from "~/lib/contact-link";
import {
  CONTACT_REASONS,
  findContactReason,
  getContactReasonSlug,
  type ContactReasonId,
} from "~/lib/contact-reasons";
import { DEFAULT_COUNTRY_CODE, listCountries } from "~/lib/countries";
import type { Faq } from "~/lib/faqs.server";
import type {
  ContactOutcome,
  ContactRejection,
} from "~/lib/forms/contact-form.server";
import type { FormProtectionFields } from "~/lib/forms/protected-form.server";
import type { Language } from "~/lib/i18n/languages";
import { getPagePath } from "~/lib/i18n/pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

interface ContactPageProps {
  readonly reason: ContactReasonId;
  readonly language: Language;
  readonly faqs: readonly Faq[];
  /** Lo que `issueFormProtection(CONTACT_FORM)` entregó en el `loader`. */
  readonly protection: FormProtectionFields;
  /** Lo que devolvió `handleContactSubmission` en el `action`. */
  readonly outcome: ContactOutcome | undefined;
}

const MAX_CONTENT_STYLES = "mx-auto max-w-[1280px] px-6";

const REASON_LABELS: Record<ContactReasonId, MessageKey> = {
  order: "contact.reason.order",
  camps: "contact.reason.camps",
  brands: "contact.reason.brands",
  tip: "contact.reason.tip",
  other: "contact.reason.other",
};

const PLACEHOLDERS: Record<ContactReasonId, MessageKey> = {
  order: "contact.placeholder.order",
  camps: "contact.placeholder.camps",
  brands: "contact.placeholder.brands",
  tip: "contact.placeholder.tip",
  other: "contact.placeholder.other",
};

const REJECTION_MESSAGES: Record<
  Exclude<ContactRejection, "rate_limited">,
  MessageKey
> = {
  too_fast: "contact.rejected.tooFast",
  verification_failed: "contact.rejected.verification",
};

// El servidor devuelve claves de traducción como mensajes de error.
const ERROR_KEYS: readonly MessageKey[] = [
  "contact.error.nameRequired",
  "contact.error.nameTooLong",
  "contact.error.email",
  "contact.error.emailTooLong",
  "contact.error.country",
  "contact.error.messageRequired",
  "contact.error.messageTooLong",
  "contact.error.orderNumberRequired",
  "contact.error.brandRequired",
  "contact.error.extraFieldTooLong",
];

function isErrorKey(message: string): message is MessageKey {
  return (ERROR_KEYS as readonly string[]).includes(message);
}

const PILL_STYLES =
  "inline-flex min-h-11 items-center rounded-pill border-2 border-brand-night px-5 py-2 text-[15px] font-bold no-underline focused:outline-brand-night";
const PILL_IDLE_STYLES =
  "text-brand-night hovered:bg-brand-night hovered:text-brand-mist";
const PILL_CURRENT_STYLES = "bg-brand-night text-brand-mist";

// Enlaces y no botones: cambian el parámetro de la dirección, así que el
// motivo sobrevive a una recarga y funciona sin JavaScript.
function ReasonPicker({
  current,
  language,
}: {
  readonly current: ContactReasonId;
  readonly language: Language;
}): ReactElement {
  const translate = useTranslate();
  const path = getPagePath("contact", language);
  return (
    <nav aria-labelledby="contact-reason-legend">
      <h2
        id="contact-reason-legend"
        className="m-0 mb-3.5 text-[13px] font-bold tracking-[0.12em] uppercase"
      >
        {translate("contact.reason.legend")}
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {CONTACT_REASONS.map(({ id }) => {
          const isCurrent = id === current;
          const query = new URLSearchParams({
            [CONTACT_REASON_PARAM]: getContactReasonSlug(id, language),
          });
          return (
            <li key={id}>
              <Link
                to={`${path}?${query.toString()}`}
                aria-current={isCurrent ? "true" : undefined}
                preventScrollReset
                className={`${PILL_STYLES} ${isCurrent ? PILL_CURRENT_STYLES : PILL_IDLE_STYLES}`}
              >
                {translate(REASON_LABELS[id])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Confirmation(): ReactElement {
  const translate = useTranslate();
  return (
    <div className="py-12 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex size-[72px] items-center justify-center rounded-pill bg-brand-lime text-brand-night"
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      </span>
      <h2 className="mt-6 mb-0 font-display text-[40px] leading-none font-normal uppercase md:text-[48px]">
        {translate("contact.sent.heading")}
      </h2>
      <p className="mx-auto mt-3 mb-0 max-w-[420px] text-ink-subtle">
        {translate("contact.sent.text")}
      </p>
    </div>
  );
}

function ConsentNotice(): ReactElement {
  const translate = useTranslate();
  return (
    <p className="m-0 text-[14px] text-ink-subtle">
      {translate("contact.consentStart")}
      <LocalizedLink page="privacy" className="text-brand-indigo underline">
        {translate("contact.consentLink")}
      </LocalizedLink>
      {translate("contact.consentEnd")}
    </p>
  );
}

function RejectionNotice({
  reason,
}: {
  readonly reason: ContactRejection;
}): ReactElement {
  const translate = useTranslate();
  const text =
    reason === "rate_limited"
      ? translate("contact.rejected.rateLimited", {
          whatsapp: WHATSAPP_DISPLAY_NUMBER,
          email: TEAM_EMAIL,
        })
      : translate(REJECTION_MESSAGES[reason]);
  return (
    <p role="alert" className="m-0 font-semibold text-brand-red-deep">
      {text}
    </p>
  );
}

function ContactFields({
  reason,
  language,
  outcome,
}: {
  readonly reason: ContactReasonId;
  readonly language: Language;
  readonly outcome: ContactOutcome | undefined;
}): ReactElement {
  const translate = useTranslate();
  const countryOptions = useMemo(
    () =>
      listCountries(language).map(({ code, name }) => ({
        value: code,
        label: name,
      })),
    [language],
  );
  const isInvalid = outcome?.status === "invalid";
  const values = isInvalid ? outcome.values : {};
  const fieldErrors = isInvalid ? outcome.fieldErrors : {};
  const translateError = (message: string | undefined): string | undefined =>
    message === undefined || !isErrorKey(message)
      ? message
      : translate(message);
  const { extraField } = findContactReason(reason);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          zone="light"
          label={translate("contact.field.name")}
          name="name"
          autoComplete="name"
          isRequired
          defaultValue={values.name}
          error={translateError(fieldErrors.name)}
        />
        <TextField
          zone="light"
          label={translate("contact.field.email")}
          name="email"
          type="email"
          autoComplete="email"
          isRequired
          defaultValue={values.email}
          error={translateError(fieldErrors.email)}
        />
        {extraField === "orderNumber" ? (
          <TextField
            zone="light"
            label={translate("contact.field.orderNumber")}
            name="orderNumber"
            placeholder={translate("contact.field.orderNumberPlaceholder")}
            isRequired
            defaultValue={values.orderNumber}
            error={translateError(fieldErrors.orderNumber)}
          />
        ) : null}
        {extraField === "brand" ? (
          <TextField
            zone="light"
            label={translate("contact.field.brand")}
            name="brand"
            isRequired
            defaultValue={values.brand}
            error={translateError(fieldErrors.brand)}
          />
        ) : null}
        <SelectField
          zone="light"
          label={translate("contact.field.country")}
          name="country"
          autoComplete="country"
          options={countryOptions}
          defaultValue={values.country ?? DEFAULT_COUNTRY_CODE}
          error={translateError(fieldErrors.country)}
        />
      </div>
      <TextAreaField
        zone="light"
        label={translate("contact.field.message")}
        name="message"
        placeholder={translate(PLACEHOLDERS[reason])}
        isRequired
        defaultValue={values.message}
        error={translateError(fieldErrors.message)}
      />
    </>
  );
}

function ContactForm({
  reason,
  language,
  protection,
  outcome,
}: Pick<
  ContactPageProps,
  "reason" | "language" | "protection" | "outcome"
>): ReactElement {
  const translate = useTranslate();
  const navigation = useNavigation();
  return (
    <Form method="post" noValidate className="mt-7 flex flex-col gap-4">
      {outcome?.status === "rejected" ? (
        <RejectionNotice reason={outcome.reason} />
      ) : null}
      <input
        type="hidden"
        name="reason"
        value={getContactReasonSlug(reason, language)}
      />
      <ContactFields reason={reason} language={language} outcome={outcome} />
      <FormProtection
        siteKey={protection.siteKey}
        timestamp={protection.timestamp}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ConsentNotice />
        <Button
          type="submit"
          zone="light"
          submittingLabel={
            navigation.state === "idle"
              ? undefined
              : translate("contact.submitting")
          }
        >
          {translate("contact.submit")}
        </Button>
      </div>
    </Form>
  );
}

/** La página de contacto (FR-053): el formulario por motivo y, al lado, los
 * otros canales. */
export function ContactPage({
  reason,
  language,
  faqs,
  protection,
  outcome,
}: ContactPageProps): ReactElement {
  const translate = useTranslate();
  const isSent = outcome?.status === "sent";

  return (
    <>
      <section className={`${MAX_CONTENT_STYLES} pt-12 pb-8 md:pt-16`}>
        <h1 className="m-0 font-display text-[64px] leading-[0.9] font-normal uppercase md:text-[96px] lg:text-[136px]">
          {translate("contact.heading")}
        </h1>
        <p className="mt-4 mb-0 max-w-[600px] text-[18px] text-ink-muted md:text-[20px]">
          {translate("contact.lead")}
        </p>
      </section>
      <section
        className={`${MAX_CONTENT_STYLES} grid items-start gap-12 pb-24 lg:grid-cols-[minmax(0,1fr)_340px]`}
      >
        <div className="min-w-0 rounded-[28px] bg-brand-mist p-6 text-brand-night md:p-10">
          {/* La región existe siempre: un lector de pantalla solo anuncia lo
              que cambia dentro de una región que ya estaba en la página. */}
          <div role="status">{isSent ? <Confirmation /> : null}</div>
          {isSent ? null : (
            <>
              <ReasonPicker current={reason} language={language} />
              <ContactForm
                reason={reason}
                language={language}
                protection={protection}
                outcome={outcome}
              />
            </>
          )}
        </div>
        <ContactSidebar faqs={faqs} language={language} />
      </section>
    </>
  );
}
