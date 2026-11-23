import type { ReactElement } from "react";

import { HomeAbout } from "~/components/home-about";
import { HomeHero } from "~/components/home-hero";
import { StatsStrip } from "~/components/stats-strip";
import { serverEnv } from "~/lib/env.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";
import { readSiteStats, type SiteStat } from "~/lib/site-stats.server";

import type { Route } from "./+types/home";

export interface HomeData {
  readonly title: string;
  readonly description: string;
  readonly language: Language;
  readonly stats: readonly SiteStat[];
  readonly cdnHost: string;
}

// Las cifras son un adorno de la home: si la base falla, la página sale sin
// ellas en vez de caerse.
async function loadStats(language: Language): Promise<readonly SiteStat[]> {
  try {
    return await readSiteStats(language);
  } catch (error) {
    console.error("No se pudieron leer las cifras de la home", error);
    return [];
  }
}

export async function loader({ request }: Route.LoaderArgs): Promise<HomeData> {
  const language = getRequestLanguage(request);
  const translate = getTranslate(language);
  return {
    title: translate("home.title"),
    description: translate("home.description"),
    language,
    stats: await loadStats(language),
    cdnHost: serverEnv.imageCdnHost,
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function Home({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return (
    <>
      <HomeHero />
      <StatsStrip stats={loaderData.stats} pageLanguage={loaderData.language} />
      <HomeAbout cdnHost={loaderData.cdnHost} />
    </>
  );
}
