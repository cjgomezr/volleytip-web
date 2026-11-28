import type { ReactElement } from "react";
import { redirect } from "react-router";

import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";
import { getPagePath } from "~/lib/i18n/pages";
import { loadTipsListing, type TipsListing } from "~/lib/tips-listing.server";
import {
  isLoadMoreRequest,
  readReportingFailure,
  type LoadMoreFailure,
} from "~/lib/tips-load-more";
import { parseTipsQuery, TIPS_PARAMETERS } from "~/lib/tips-query";

import type { Route } from "./+types/tips";
import { TipsPage } from "./tips-page";

export interface TipsData {
  readonly title: string;
  readonly description: string;
  readonly language: Language;
  readonly listing: TipsListing;
}

// La misma dirección sin la página. Lo demás se conserva.
function toFirstPage(url: URL, language: Language): Response {
  const params = new URLSearchParams(url.searchParams);
  params.delete(TIPS_PARAMETERS[language].page);
  const search = params.size === 0 ? "" : `?${params}`;
  return redirect(`${getPagePath("tips", language)}${search}`);
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<TipsData | Response> {
  const language = getRequestLanguage(request);
  const url = new URL(request.url);
  const query = parseTipsQuery(url.searchParams, language);
  const isLoadingMore = isLoadMoreRequest(request);
  const listing = await loadTipsListing(language, query, {
    withLatest: !isLoadingMore,
  });
  // Una página que ya no existe (una dirección vieja, tips retirados) lleva a
  // la primera en vez de decir que no hay resultados. Quien pide más recibe la
  // página vacía: redirigirlo le quitaría lo que ya cargó.
  const isPastTheEnd = listing.tips.length === 0 && listing.total > 0;
  if (isPastTheEnd && !isLoadingMore) return toFirstPage(url, language);
  const translate = getTranslate(language);
  return {
    title: translate("tips.title"),
    description: translate("tips.description"),
    language,
    listing,
  };
}

export function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs): Promise<TipsData | LoadMoreFailure> {
  return readReportingFailure<TipsData>(request, () => serverLoader());
}

// El fallo solo le llega a quien pide más tips, nunca a la página: ni `meta`
// ni el componente lo reciben al navegar.
export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  if (!("listing" in loaderData)) return [];
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function Tips({
  loaderData,
}: Route.ComponentProps): ReactElement | null {
  if (!("listing" in loaderData)) return null;
  return (
    <TipsPage listing={loaderData.listing} language={loaderData.language} />
  );
}
