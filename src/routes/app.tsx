import type { ReactElement } from "react";

import {
  readAppAvailability,
  type AppAvailability,
} from "~/lib/app-availability.server";
import {
  WAITLIST_FORM,
  handleWaitlistSubmission,
} from "~/lib/forms/waitlist-form.server";
import {
  issueFormProtection,
  type FormProtectionFields,
} from "~/lib/forms/protected-form.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";

import type { Route } from "./+types/app";
import { AppPage } from "./app-page";

export interface AppLoaderData {
  readonly title: string;
  readonly description: string;
  readonly availability: AppAvailability;
  readonly protection: FormProtectionFields;
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<AppLoaderData> {
  const translate = getTranslate(getRequestLanguage(request));
  return {
    title: translate("app.title"),
    description: translate("app.description"),
    availability: await readAppAvailability(),
    protection: issueFormProtection(WAITLIST_FORM),
  };
}

export function action({
  request,
}: Route.ActionArgs): ReturnType<typeof handleWaitlistSubmission> {
  return handleWaitlistSubmission(request, "app");
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function App({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <AppPage
      availability={loaderData.availability}
      protection={loaderData.protection}
      outcome={actionData}
    />
  );
}
