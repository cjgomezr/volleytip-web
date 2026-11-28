import type { ReactElement } from "react";
import { redirect } from "react-router";

import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";
import { loadTipsListing, type TipsListing } from "~/lib/tips-listing.server";
import { getTipsListPath } from "~/lib/tips-path";
import { parseTipsQuery } from "~/lib/tips-query";

import type { Route } from "./+types/tips";
import { TipsPage } from "./tips-page";

export interface TipsData {
  readonly title: string;
  readonly description: string;
  readonly language: Language;
  readonly listing: TipsListing;
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<TipsData | Response> {
  const language = getRequestLanguage(request);
  const query = parseTipsQuery(new URL(request.url).searchParams, language);
  const listing = await loadTipsListing(language, query);
  // Una página que ya no existe (una dirección vieja, tips retirados) lleva a
  // la primera en vez de decir que no hay resultados.
  if (listing.tips.length === 0 && listing.total > 0) {
    return redirect(getTipsListPath(language, { ...query, page: 1 }));
  }
  const translate = getTranslate(language);
  return {
    title: translate("tips.title"),
    description: translate("tips.description"),
    language,
    listing,
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function Tips({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return (
    <TipsPage listing={loaderData.listing} language={loaderData.language} />
  );
}
