import type { ReactElement } from "react";

import { WaitlistForm } from "~/components/waitlist-form";
import type { AppAvailability } from "~/lib/app-availability.server";
import type { FormProtectionFields } from "~/lib/forms/protected-form.server";
import type { WaitlistOutcome } from "~/lib/forms/waitlist-form.server";
import { useTranslate } from "~/lib/i18n/translations-context";

import { StoreButtons } from "./app-page";

export interface RoutineLinkPageProps {
  readonly availability: AppAvailability;
  readonly protection: FormProtectionFields;
  readonly outcome: WaitlistOutcome | undefined;
}

/** Lo que ve quien abre un enlace de rutina sin tener la app (FR-080). */
export function RoutineLinkPage({
  availability,
  protection,
  outcome,
}: RoutineLinkPageProps): ReactElement {
  const translate = useTranslate();
  return (
    <section data-zone="dark" className="pt-10 pb-20">
      <div className="mx-auto max-w-[720px] px-6">
        {availability.state === "available" ? null : (
          <p className="inline-block rounded-md bg-brand-lime px-3 py-1.5 text-[13px] font-bold tracking-[0.08em] text-brand-night uppercase">
            {translate("app.badge")}
          </p>
        )}
        <h1 className="mt-5 font-display text-[44px] leading-[0.95] break-words uppercase md:text-[72px]">
          {translate("routineLink.heading")}
        </h1>
        <p className="mt-6 text-[18px] leading-[1.5] text-ink-muted md:text-[20px]">
          {translate(
            availability.state === "available"
              ? "routineLink.textAvailable"
              : "routineLink.text",
          )}
        </p>
        {availability.state === "available" ? (
          <StoreButtons
            appStoreUrl={availability.appStoreUrl}
            playStoreUrl={availability.playStoreUrl}
          />
        ) : (
          <WaitlistForm protection={protection} outcome={outcome} />
        )}
      </div>
    </section>
  );
}
