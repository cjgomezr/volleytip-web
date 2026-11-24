import type { ReactElement } from "react";
import { data } from "react-router";

import { CampNotify } from "~/components/camp-notify";

import { HomeAbout } from "~/components/home-about";
import { HomeHero } from "~/components/home-hero";
import { StatsStrip } from "~/components/stats-strip";
import type { CampNotifyOutcome } from "~/lib/camp-notify";
import {
  CAMP_NOTIFY_FORM,
  type CampNotifyErrorKey,
} from "~/lib/camp-notify-form.server";
import { serverEnv } from "~/lib/env.server";
import {
  issueFormProtection,
  processProtectedForm,
  type FormProtectionFields,
} from "~/lib/forms/protected-form.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";
import type { Translate } from "~/lib/i18n/translate";
import { getCurrentLegalVersion } from "~/lib/legal/legal-documents";
import { loadSiteStats } from "~/lib/load-site-stats.server";
import type { SiteStat } from "~/lib/site-stats.server";
import { hasUpcomingCamps } from "~/lib/upcoming-camps";
import { joinWaitlist } from "~/lib/waitlists.server";

import type { Route } from "./+types/home";

export interface HomeData {
  readonly title: string;
  readonly description: string;
  readonly language: Language;
  readonly stats: readonly SiteStat[];
  readonly cdnHost: string;
  /** Verdadero cuando no hay camps próximos y se invita a dejar el correo. */
  readonly showCampNotify: boolean;
  readonly protection: FormProtectionFields;
}

export async function loader({ request }: Route.LoaderArgs): Promise<HomeData> {
  const language = getRequestLanguage(request);
  const translate = getTranslate(language);
  return {
    title: translate("home.title"),
    description: translate("home.description"),
    language,
    stats: await loadSiteStats(language),
    cdnHost: serverEnv.imageCdnHost,
    showCampNotify: !hasUpcomingCamps(),
    protection: issueFormProtection(CAMP_NOTIFY_FORM),
  };
}

const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const TOO_MANY_REQUESTS_STATUS = 429;

function translateFieldErrors(
  fieldErrors: Readonly<Record<string, string>>,
  translate: Translate,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, key]) => [
      field,
      // Los mensajes del esquema son claves de traducción.
      translate(key as CampNotifyErrorKey),
    ]),
  );
}

export async function action({
  request,
}: Route.ActionArgs): Promise<ReturnType<typeof data<CampNotifyOutcome>>> {
  const language = getRequestLanguage(request);
  const translate = getTranslate(language);
  const result = await processProtectedForm(request, CAMP_NOTIFY_FORM);
  switch (result.status) {
    case "accepted":
      await joinWaitlist({
        kind: "camp_notify",
        email: result.data.email,
        locale: language,
        countryCode: null,
        city: result.data.city,
        privacyVersion: getCurrentLegalVersion("privacy"),
      });
      return data({ status: "joined" }, { status: OK_STATUS });
    case "discarded":
      // A quien llenó el campo trampa se le responde como a un éxito.
      return data({ status: "joined" }, { status: OK_STATUS });
    case "invalid":
      return data(
        {
          status: "invalid",
          fieldErrors: translateFieldErrors(result.fieldErrors, translate),
          values: result.values,
        },
        { status: BAD_REQUEST_STATUS },
      );
    case "rate_limited":
      return data(
        { status: "rejected", message: translate("notify.error.rateLimited") },
        { status: TOO_MANY_REQUESTS_STATUS },
      );
    case "too_fast":
    case "verification_failed":
      return data(
        { status: "rejected", message: translate("notify.error.verification") },
        { status: BAD_REQUEST_STATUS },
      );
  }
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function Home({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <>
      <HomeHero />
      <StatsStrip stats={loaderData.stats} pageLanguage={loaderData.language} />
      <HomeAbout cdnHost={loaderData.cdnHost} />
      {loaderData.showCampNotify ? (
        <CampNotify
          protection={loaderData.protection}
          serverOutcome={actionData}
        />
      ) : null}
    </>
  );
}
