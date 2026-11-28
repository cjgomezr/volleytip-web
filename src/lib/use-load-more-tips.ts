import { useState } from "react";
import { useFetcher } from "react-router";

import type { Language } from "./i18n/languages";
import type { TipCardData, TipsListing } from "./tips-listing.server";
import {
  appendTipsPage,
  joinTips,
  toLoadMoreHref,
  type AppendedTips,
  type LoadMoreFailure,
} from "./tips-load-more";
import { getTipsListPath } from "./tips-path";

export interface LoadMoreTips {
  /** Los que llegaron con la página y los cargados después. */
  readonly tips: readonly TipCardData[];
  /** Los que trajo la última carga. */
  readonly added: readonly TipCardData[];
  readonly hasNextPage: boolean;
  readonly nextHref: string;
  readonly isLoading: boolean;
  /** La última carga falló. Se puede volver a pedir. */
  readonly hasFailed: boolean;
  readonly loadMore: () => void;
}

/**
 * Pide las páginas siguientes del listado y las junta con la que llegó con la
 * dirección. Quien lo usa se monta de nuevo en cada navegación: lo cargado
 * vale solo para esa dirección.
 */
export function useLoadMoreTips(
  listing: TipsListing,
  language: Language,
): LoadMoreTips {
  const fetcher = useFetcher<
    { readonly listing: TipsListing } | LoadMoreFailure
  >();
  const [appended, setAppended] = useState<AppendedTips>(() => ({
    extra: [],
    page: listing.query.page,
    hasNextPage: listing.hasNextPage,
    added: [],
  }));
  // La página recibida se junta durante el pintado, no en un efecto: en el
  // siguiente, `appendTipsPage` ya no la reconoce como la que falta.
  const answer = fetcher.data;
  const received = answer && "listing" in answer ? answer.listing : undefined;
  const next = received
    ? appendTipsPage(appended, listing.tips, received)
    : appended;
  if (next !== appended) setAppended(next);

  const nextHref = getTipsListPath(language, {
    ...listing.query,
    page: next.page + 1,
  });
  const isLoading = fetcher.state !== "idle";

  function loadMore(): void {
    if (!isLoading) void fetcher.load(toLoadMoreHref(nextHref));
  }

  return {
    tips: joinTips(listing.tips, next.extra),
    added: next.added,
    hasNextPage: next.hasNextPage,
    nextHref,
    isLoading,
    hasFailed: !isLoading && answer !== undefined && "hasFailed" in answer,
    loadMore,
  };
}
