import type { ReactElement } from "react";

import { serverEnv } from "~/lib/env.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";
import { loadSiteStats } from "~/lib/load-site-stats.server";
import type { SiteStat } from "~/lib/site-stats.server";

import type { Route } from "./+types/about";
import { AboutPage } from "./about-page";

export interface AboutData {
  readonly title: string;
  readonly description: string;
  readonly language: Language;
  readonly stats: readonly SiteStat[];
  readonly cdnHost: string;
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<AboutData> {
  const language = getRequestLanguage(request);
  const translate = getTranslate(language);
  return {
    title: translate("about.title"),
    description: translate("about.description"),
    language,
    stats: await loadSiteStats(language),
    cdnHost: serverEnv.imageCdnHost,
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function About({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return (
    <AboutPage
      stats={loaderData.stats}
      language={loaderData.language}
      cdnHost={loaderData.cdnHost}
    />
  );
}
