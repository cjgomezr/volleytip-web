import { useEffect, useRef, type MouseEvent, type ReactElement } from "react";
import { Link } from "react-router";

import type { Language } from "~/lib/i18n/languages";
import { isPlainLeftClick } from "~/lib/i18n/save-language-choice";
import { useTranslate } from "~/lib/i18n/translations-context";
import type { TipsListing } from "~/lib/tips-listing.server";
import { hasTipFilters } from "~/lib/tips-query";
import { useLoadMoreTips, type LoadMoreTips } from "~/lib/use-load-more-tips";

import { getButtonLinkClassName } from "../button";

import { TipCard } from "./tip-card";

const SPINNER_STYLES =
  "size-4 shrink-0 animate-spin rounded-pill border-2 border-current border-t-transparent motion-reduce:animate-none";

// Sin JavaScript es un enlace a la página siguiente; con él, trae esos tips
// debajo de los que ya están.
function LoadMoreLink({
  nextHref,
  isLoading,
  loadMore,
}: LoadMoreTips): ReactElement {
  const translate = useTranslate();

  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    loadMore();
  }

  return (
    <Link
      to={nextHref}
      onClick={handleClick}
      aria-busy={isLoading ? "true" : undefined}
      className={getButtonLinkClassName("secondary", "dark")}
    >
      {isLoading ? (
        <span aria-hidden="true" className={SPINNER_STYLES} />
      ) : null}
      {translate("tips.loadMore")}
    </Link>
  );
}

function LoadMoreStatus({ isLoading, added }: LoadMoreTips): ReactElement {
  const translate = useTranslate();
  function describe(): string {
    if (isLoading) return translate("tips.loadMore.loading");
    return added.length === 0
      ? ""
      : translate("tips.loadMore.loaded", { count: added.length });
  }
  return (
    <p role="status" className="sr-only">
      {describe()}
    </p>
  );
}

function ResultsHeading({
  listing,
}: {
  readonly listing: TipsListing;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <h2 className="m-0 font-display text-[36px] leading-none font-normal uppercase md:text-[40px]">
        {hasTipFilters(listing.query)
          ? translate("tips.list.results", { count: listing.total })
          : translate("tips.list.heading")}
      </h2>
      <p className="m-0 text-[16px] text-ink-muted">
        {translate("tips.list.order")}
      </p>
    </div>
  );
}

/** La cuadrícula de tips con su "Cargar más tips". */
export function TipResults({
  listing,
  language,
}: {
  readonly listing: TipsListing;
  readonly language: Language;
}): ReactElement {
  const more = useLoadMoreTips(listing, language);
  const firstAddedRef = useRef<HTMLAnchorElement>(null);
  // Con la última página desaparece el enlace que tenía el foco: pasa al
  // primer tip que llegó, y no al comienzo del documento.
  const focusId = more.hasNextPage ? undefined : more.added[0]?.id;
  useEffect(() => {
    if (focusId !== undefined) firstAddedRef.current?.focus();
  }, [focusId]);

  return (
    <>
      <ResultsHeading listing={listing} />
      <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-6 p-0 md:grid-cols-4 md:gap-x-4 lg:grid-cols-6">
        {more.tips.map((tip) => (
          <li key={tip.id} className="min-w-0">
            <TipCard
              tip={tip}
              language={language}
              linkRef={tip.id === focusId ? firstAddedRef : undefined}
            />
          </li>
        ))}
      </ul>
      {more.hasNextPage ? (
        <div className="mt-10 flex justify-center">
          <LoadMoreLink {...more} />
        </div>
      ) : null}
      <LoadMoreStatus {...more} />
    </>
  );
}
