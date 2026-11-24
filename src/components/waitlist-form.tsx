import { useMemo, type ReactElement } from "react";
import { Form, useNavigation } from "react-router";

import { DEFAULT_COUNTRY_CODE, listCountries } from "~/lib/countries";
import type { FormProtectionFields } from "~/lib/forms/protected-form.server";
import type {
  WaitlistOutcome,
  WaitlistRejection,
} from "~/lib/forms/waitlist-form.server";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import type { MessageKey } from "~/lib/i18n/translate";

import { Button } from "./button";
import { FormProtection } from "./form-protection";
import { LocalizedLink } from "./localized-link";
import { SelectField } from "./select-field";
import { TextField } from "./text-field";

interface WaitlistFormProps {
  /** Lo que `issueFormProtection(WAITLIST_FORM)` entregó en el `loader`. */
  readonly protection: FormProtectionFields;
  /** Lo que devolvió `handleWaitlistSubmission` en el `action`. */
  readonly outcome: WaitlistOutcome | undefined;
}

const REJECTION_MESSAGES: Record<WaitlistRejection, MessageKey> = {
  too_fast: "waitlist.rejected.tooFast",
  verification_failed: "waitlist.rejected.verification",
  rate_limited: "waitlist.rejected.rateLimited",
};

// El servidor devuelve claves de traducción como mensajes de error.
const ERROR_KEYS: readonly MessageKey[] = [
  "waitlist.error.email",
  "waitlist.error.emailTooLong",
  "waitlist.error.country",
];

function isErrorKey(message: string): message is MessageKey {
  return (ERROR_KEYS as readonly string[]).includes(message);
}

function CheckIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function Confirmation(): ReactElement {
  const translate = useTranslate();
  return (
    <p className="mt-8 inline-flex items-center gap-3.5 rounded-pill bg-brand-indigo py-3.5 pr-6 pl-3.5 font-bold">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-brand-lime text-brand-night">
        <CheckIcon />
      </span>
      {translate("waitlist.joined")}
    </p>
  );
}

function ConsentNotice(): ReactElement {
  const translate = useTranslate();
  return (
    <p className="text-[14px] text-ink-muted">
      {translate("waitlist.consentStart")}
      <LocalizedLink
        page="privacy"
        className="underline hovered:text-brand-lime"
      >
        {translate("waitlist.consentLink")}
      </LocalizedLink>
      {translate("waitlist.consentEnd")}
    </p>
  );
}

/**
 * El formulario de lista de espera: correo, país y las capas de protección.
 * Con un envío aceptado se reemplaza por la confirmación, que vive dentro de
 * una región de estado para que un lector de pantalla la anuncie.
 */
export function WaitlistForm({
  protection,
  outcome,
}: WaitlistFormProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const navigation = useNavigation();
  const countries = useMemo(() => listCountries(language), [language]);
  const countryOptions = countries.map(({ code, name }) => ({
    value: code,
    label: name,
  }));
  const isInvalid = outcome?.status === "invalid";
  const values = isInvalid ? outcome.values : {};
  const fieldErrors = isInvalid ? outcome.fieldErrors : {};
  const translateError = (message: string | undefined): string | undefined =>
    message === undefined || !isErrorKey(message)
      ? message
      : translate(message);

  // La región existe siempre: un lector de pantalla solo anuncia lo que
  // cambia dentro de una región que ya estaba en la página.
  return (
    <div className="max-w-[560px]">
      <div role="status">
        {outcome?.status === "joined" ? <Confirmation /> : null}
      </div>
      {outcome?.status === "joined" ? null : (
        <Form method="post" noValidate className="mt-8 flex flex-col gap-5">
          {outcome?.status === "rejected" ? (
            <p role="alert" className="font-semibold text-brand-red">
              {translate(REJECTION_MESSAGES[outcome.reason])}
            </p>
          ) : null}
          <div className="grid gap-5 md:grid-cols-[1fr_180px] md:items-start">
            <TextField
              label={translate("waitlist.emailLabel")}
              name="email"
              type="email"
              autoComplete="email"
              placeholder={translate("waitlist.emailPlaceholder")}
              isRequired
              defaultValue={values.email}
              error={translateError(fieldErrors.email)}
            />
            <SelectField
              label={translate("waitlist.countryLabel")}
              name="country"
              autoComplete="country"
              options={countryOptions}
              defaultValue={values.country ?? DEFAULT_COUNTRY_CODE}
              error={translateError(fieldErrors.country)}
            />
          </div>
          <FormProtection
            siteKey={protection.siteKey}
            timestamp={protection.timestamp}
          />
          <div>
            <Button
              type="submit"
              submittingLabel={
                navigation.state === "idle"
                  ? undefined
                  : translate("waitlist.submitting")
              }
            >
              {translate("waitlist.submit")}
            </Button>
          </div>
          <ConsentNotice />
        </Form>
      )}
    </div>
  );
}
