import type { ReactElement } from "react";
import { data } from "react-router";

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
import { isRoutineCode } from "~/lib/routine-code";

import type { Route } from "./+types/routine-link";
import { RoutineLinkPage } from "./routine-link-page";

const NOT_FOUND_STATUS = 404;

export interface RoutineLinkLoaderData {
  readonly title: string;
  readonly description: string;
  readonly availability: AppAvailability;
  readonly protection: FormProtectionFields;
}

// El código solo valida la dirección: no se lee en ninguna tabla ni llega a
// la página, así que todos los códigos muestran lo mismo.
export async function loader({
  request,
  params,
}: Route.LoaderArgs): Promise<RoutineLinkLoaderData> {
  if (!isRoutineCode(params.code)) {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const translate = getTranslate(getRequestLanguage(request));
  return {
    title: translate("routineLink.title"),
    description: translate("routineLink.description"),
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
    { name: "robots", content: "noindex" },
  ];
}

export default function RoutineLink({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return (
    <RoutineLinkPage
      availability={loaderData.availability}
      protection={loaderData.protection}
      outcome={actionData}
    />
  );
}
