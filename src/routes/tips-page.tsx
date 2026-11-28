import type { ReactElement } from "react";
import { useLocation, useNavigation } from "react-router";

import { LatestTip } from "~/components/tips/latest-tip";
import { TipResults } from "~/components/tips/tip-results";
import { NoMatchingTips, NoPublishedTips } from "~/components/tips/tips-empty";
import { TipsFilters } from "~/components/tips/tips-filters";
import { TipsSearch } from "~/components/tips/tips-search";
import type { Language } from "~/lib/i18n/languages";
import { getPagePath } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import type { TipsListing } from "~/lib/tips-listing.server";
import { hasTipFilters } from "~/lib/tips-query";

const CONTENT_STYLES = "mx-auto max-w-[1280px] px-4 md:px-6";

interface TipsPageProps {
  readonly listing: TipsListing;
  readonly language: Language;
}

function TipsHeader({ listing, language }: TipsPageProps): ReactElement {
  const translate = useTranslate();
  const hasTips = listing.publishedTotal > 0;
  return (
    <div
      className={`${CONTENT_STYLES} flex flex-col gap-6 pt-6 pb-4 md:flex-row md:items-end md:justify-between md:gap-8 md:pt-10 md:pb-6`}
    >
      <div className="min-w-0">
        <h1 className="m-0 font-display text-[80px] leading-[0.9] font-normal uppercase lg:text-[144px]">
          {translate("tips.heading")}
        </h1>
        {hasTips ? (
          <p className="mt-3 mb-0 text-[18px] leading-[1.5] text-ink-muted md:text-[20px]">
            {translate("tips.intro", { count: listing.publishedTotal })}
          </p>
        ) : null}
      </div>
      {hasTips ? (
        <TipsSearch query={listing.query} language={language} />
      ) : null}
    </div>
  );
}

function TipsContent({ listing, language }: TipsPageProps): ReactElement {
  const translate = useTranslate();
  const { key } = useLocation();
  const { location: destination } = useNavigation();
  // Mientras llega otra búsqueda del listado, lo que se ve queda atenuado.
  const isSearching = destination?.pathname === getPagePath("tips", language);

  function describeResults(): string {
    if (isSearching) return translate("tips.loadMore.loading");
    return hasTipFilters(listing.query)
      ? translate("tips.list.results", { count: listing.total })
      : "";
  }

  return (
    <div
      aria-busy={isSearching ? "true" : undefined}
      className={`${CONTENT_STYLES} pt-8 pb-16 transition-opacity motion-reduce:transition-none ${isSearching ? "opacity-50" : ""}`}
    >
      {listing.latestTip === null ? null : (
        <div className="mb-12">
          <LatestTip tip={listing.latestTip} language={language} />
        </div>
      )}
      {listing.total === 0 ? (
        <NoMatchingTips />
      ) : (
        // Otra navegación es otra lista: lo cargado antes no se arrastra.
        <TipResults key={key} listing={listing} language={language} />
      )}
      {/* Existe desde antes de la búsqueda para que se anuncie lo que trae. */}
      <p role="status" className="sr-only">
        {describeResults()}
      </p>
    </div>
  );
}

/** El listado de tips (FR-013). */
export function TipsPage(props: TipsPageProps): ReactElement {
  const { listing, language } = props;
  return (
    <>
      <TipsHeader {...props} />
      {listing.publishedTotal > 0 ? (
        <>
          <TipsFilters query={listing.query} language={language} />
          <TipsContent {...props} />
        </>
      ) : (
        <div className={`${CONTENT_STYLES} pt-8 pb-24`}>
          <NoPublishedTips />
        </div>
      )}
    </>
  );
}
