import type { ReactElement } from "react";
import { useFetcher } from "react-router";

import type { CampNotifyOutcome } from "~/lib/camp-notify";
import type { FormProtectionFields } from "~/lib/forms/protected-form.server";
import { useTranslate } from "~/lib/i18n/translations-context";

import { Button } from "./button";
import { FormProtection } from "./form-protection";
import { LocalizedLink } from "./localized-link";
import { TextField } from "./text-field";

interface CampNotifyProps {
  readonly protection: FormProtectionFields;
  /** Lo que respondió el `action` en una carga completa (sin JavaScript). */
  readonly serverOutcome?: CampNotifyOutcome;
}

/**
 * La invitación "Avísame": correo y ciudad opcional para enterarse del
 * próximo camp. Con JavaScript la persona se queda donde está; sin él, el
 * formulario envía igual y la página vuelve con la confirmación.
 */
export function CampNotify({
  protection,
  serverOutcome,
}: CampNotifyProps): ReactElement {
  const translate = useTranslate();
  const fetcher = useFetcher<CampNotifyOutcome>();
  const outcome = fetcher.data ?? serverOutcome;
  const isSending = fetcher.state !== "idle";
  const values = outcome?.status === "invalid" ? outcome.values : {};
  const fieldErrors = outcome?.status === "invalid" ? outcome.fieldErrors : {};

  return (
    <section
      aria-labelledby="camp-notify-title"
      className="bg-brand-indigo text-brand-mist"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
        <h2
          id="camp-notify-title"
          className="m-0 font-display text-[40px] leading-none font-normal uppercase md:text-[56px]"
        >
          {translate("notify.title")}
        </h2>
        <p className="mt-4 mb-0 max-w-[44ch] text-[16px] leading-[1.5]">
          {translate("notify.text")}
        </p>
        {/* Región viva siempre presente: el lector de pantalla anuncia la
            confirmación cuando aparece dentro de ella. */}
        <div role="status" className="mt-8 max-w-[420px]">
          {outcome?.status === "joined" ? (
            <p className="m-0 text-[20px] leading-[1.4] font-bold">
              {translate("notify.confirmation")}
            </p>
          ) : (
            <fetcher.Form
              method="post"
              noValidate
              className="flex flex-col items-start gap-6"
            >
              <TextField
                label={translate("notify.emailLabel")}
                name="email"
                type="email"
                autoComplete="email"
                isRequired
                defaultValue={values.email}
                error={fieldErrors.email}
              />
              <TextField
                label={translate("notify.cityLabel")}
                name="city"
                autoComplete="address-level2"
                defaultValue={values.city}
                error={fieldErrors.city}
              />
              <FormProtection
                siteKey={protection.siteKey}
                timestamp={protection.timestamp}
              />
              {outcome?.status === "rejected" ? (
                <p className="m-0 text-[14px] font-semibold text-brand-red">
                  {outcome.message}
                </p>
              ) : null}
              <p className="m-0 text-[13px] leading-[1.4]">
                {translate("notify.privacyPrefix")}
                <LocalizedLink page="privacy" className="underline">
                  {translate("notify.privacyLink")}
                </LocalizedLink>
                {translate("notify.privacySuffix")}
              </p>
              <Button
                type="submit"
                submittingLabel={
                  isSending ? translate("notify.submitting") : undefined
                }
              >
                {translate("notify.submit")}
              </Button>
            </fetcher.Form>
          )}
        </div>
      </div>
    </section>
  );
}
