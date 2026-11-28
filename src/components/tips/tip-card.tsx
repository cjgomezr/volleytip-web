import type { ReactElement, Ref } from "react";
import { Link } from "react-router";

import type { Language } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { TIP_FUNDAMENTAL_NAME_KEYS, TIP_LEVEL_NAME_KEYS } from "~/lib/tips";
import type { TipCardData } from "~/lib/tips-listing.server";
import { getTipPath } from "~/lib/tips-path";

import { TRANSITION_STYLES } from "../pressable-styles";

import { THUMBNAIL_TAG_STYLES, TipThumbnail } from "./tip-thumbnail";

interface TipCardProps {
  readonly tip: TipCardData;
  readonly language: Language;
  readonly linkRef?: Ref<HTMLAnchorElement>;
}

/** Un tip de la cuadrícula. Toda la tarjeta es el enlace a su página. */
export function TipCard({
  tip,
  language,
  linkRef,
}: TipCardProps): ReactElement {
  const translate = useTranslate();
  return (
    <Link
      ref={linkRef}
      to={getTipPath(language, tip.slug)}
      className="group block rounded-card text-brand-mist no-underline"
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-card bg-brand-indigo">
        <TipThumbnail
          url={tip.thumbnailUrl}
          durationSeconds={tip.durationSeconds}
        />
        <span
          className={`${THUMBNAIL_TAG_STYLES} absolute top-2.5 left-2.5 text-[11px] tracking-[0.06em] uppercase`}
        >
          {translate(TIP_FUNDAMENTAL_NAME_KEYS[tip.fundamental])}
        </span>
      </div>
      <h3
        lang={tip.titleLanguage === language ? undefined : tip.titleLanguage}
        className={`mt-2.5 mb-0 text-[16px] leading-[1.3] font-bold break-words group-hover:text-brand-lime group-active:text-brand-lime ${TRANSITION_STYLES}`}
      >
        {tip.title}
      </h3>
      <p className="mt-1 mb-0 text-[14px] text-ink-muted">
        {translate(TIP_LEVEL_NAME_KEYS[tip.level])}
      </p>
    </Link>
  );
}
