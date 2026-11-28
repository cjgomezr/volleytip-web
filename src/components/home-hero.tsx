import type { ReactElement } from "react";

import { TRANSITION_STYLES } from "~/components/pressable-styles";
import { SocialNetworkLinks } from "~/components/social-network-links";
import { useTranslate } from "~/lib/i18n/translations-context";
import { TIKTOK_URL } from "~/lib/social-links";

const CTA_STYLES = `inline-flex min-h-[54px] items-center justify-center rounded-pill bg-brand-red px-7 py-2 text-[17px] leading-tight font-bold text-brand-night no-underline hovered:bg-brand-lime pressed:bg-brand-mist ${TRANSITION_STYLES}`;

/**
 * El héroe de la home. El botón principal lleva a TikTok en otra pestaña;
 * pasará a ser un enlace al listado de tips con #162.
 */
export function HomeHero(): ReactElement {
  const translate = useTranslate();

  return (
    <section className="mx-auto max-w-[1280px] px-6 pt-10 pb-12 md:pt-16 md:pb-20">
      <p className="m-0 text-[12px] font-bold tracking-[0.12em] uppercase">
        {translate("home.eyebrow")}
      </p>
      <h1 className="mt-4 mb-0 font-display text-[56px] leading-[0.95] font-normal uppercase md:text-[96px]">
        {translate("home.headingStart")}{" "}
        <span className="text-brand-red">
          {translate("home.headingHighlight")}
        </span>{" "}
        {translate("home.headingEnd")}
      </h1>
      <p className="mt-6 mb-0 max-w-[44ch] text-[16px] leading-[1.5] text-ink-muted">
        {translate("home.intro")}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href={TIKTOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={CTA_STYLES}
        >
          {translate("home.hero.cta")}
          <span className="sr-only">
            {" "}
            {translate("home.hero.opensInNewTab")}
          </span>
        </a>
        <SocialNetworkLinks />
      </div>
    </section>
  );
}
