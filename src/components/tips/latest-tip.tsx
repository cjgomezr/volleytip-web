import type { ReactElement } from "react";
import { Link } from "react-router";

import type { Language } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { TIP_FUNDAMENTAL_NAME_KEYS, TIP_LEVEL_NAME_KEYS } from "~/lib/tips";
import type { LatestTipData } from "~/lib/tips-listing.server";
import { getTipPath } from "~/lib/tips-path";

import { TRANSITION_STYLES } from "../pressable-styles";

import { TipThumbnail } from "./tip-thumbnail";

const CHIP_STYLES = "rounded-pill border border-ink-muted px-3 py-1.5";

// Un texto que cayó al español dentro de una página en inglés se marca para
// que el lector de pantalla lo pronuncie bien.
function langFor(
  fieldLanguage: Language,
  pageLanguage: Language,
): Language | undefined {
  return fieldLanguage === pageLanguage ? undefined : fieldLanguage;
}

/** El destacado, o el más reciente, encima del listado. */
export function LatestTip({
  tip,
  language,
}: {
  readonly tip: LatestTipData;
  readonly language: Language;
}): ReactElement {
  const translate = useTranslate();
  return (
    <Link
      to={getTipPath(language, tip.slug)}
      className="group flex flex-col items-center gap-6 rounded-panel bg-brand-indigo p-6 text-brand-mist no-underline md:flex-row md:gap-8"
    >
      <div className="relative aspect-[9/16] w-[220px] max-w-full shrink-0 overflow-hidden rounded-card bg-brand-night">
        <TipThumbnail
          url={tip.thumbnailUrl}
          durationSeconds={tip.durationSeconds}
          isPriority
        />
      </div>
      <div className="w-full min-w-0">
        <p className="m-0">
          <span className="inline-block rounded-tag bg-brand-red px-2.5 py-1.5 text-[12px] font-bold tracking-[0.08em] text-brand-night uppercase">
            {translate("tips.latest.badge")}
          </span>
        </p>
        <h2
          lang={langFor(tip.titleLanguage, language)}
          className={`mt-4 mb-0 font-display text-[36px] leading-none font-normal break-words uppercase group-hover:text-brand-lime group-active:text-brand-lime md:text-[56px] ${TRANSITION_STYLES}`}
        >
          {tip.title}
        </h2>
        {tip.achievement === null ? null : (
          <p
            lang={langFor(tip.achievementLanguage, language)}
            className="mt-3.5 mb-0 max-w-[560px] text-[18px] leading-[1.5] break-words text-ink-muted"
          >
            {tip.achievement}
          </p>
        )}
        <p className="mt-5 mb-0 flex flex-wrap gap-2.5 text-[14px] font-semibold">
          <span className={CHIP_STYLES}>
            {translate(TIP_FUNDAMENTAL_NAME_KEYS[tip.fundamental])}
          </span>
          <span className={CHIP_STYLES}>
            {translate(TIP_LEVEL_NAME_KEYS[tip.level])}
          </span>
        </p>
      </div>
    </Link>
  );
}
