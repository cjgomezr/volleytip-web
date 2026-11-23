import type { ReactElement } from "react";

import {
  OUTLINE_INTERACTIVE_STYLES,
  OUTLINE_ZONE_STYLES,
  TRANSITION_STYLES,
} from "~/components/pressable-styles";
import { SocialIcon } from "~/components/social-icons";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import {
  SOCIAL_NETWORKS,
  TIKTOK_URL,
  type SocialNetworkId,
} from "~/lib/social-links";

// Las redes del héroe son las del mockup; WhatsApp es solo del pie.
const HERO_NETWORK_LABEL_KEYS: Readonly<
  Partial<Record<SocialNetworkId, MessageKey>>
> = {
  tiktok: "footer.social.tiktok",
  instagram: "footer.social.instagram",
  youtube: "footer.social.youtube",
  facebook: "footer.social.facebook",
};

const CTA_STYLES = `inline-flex min-h-[54px] items-center justify-center rounded-pill bg-brand-red px-7 py-2 text-[17px] leading-tight font-bold text-brand-night no-underline hovered:bg-brand-lime pressed:bg-brand-mist ${TRANSITION_STYLES}`;

const NETWORK_LINK_STYLES = `inline-flex size-11 shrink-0 items-center justify-center rounded-pill border-2 bg-transparent no-underline ${OUTLINE_ZONE_STYLES.dark} ${OUTLINE_INTERACTIVE_STYLES.dark} ${TRANSITION_STYLES}`;

/**
 * El héroe de la home. El botón principal lleva a TikTok en otra pestaña
 * mientras el listado de tips no exista en el mapa de páginas; cuando exista,
 * pasa a ser un enlace a esa página.
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
        <ul
          aria-label={translate("footer.social.label")}
          className="m-0 flex list-none gap-3 p-0"
        >
          {SOCIAL_NETWORKS.map(({ id, href }) => {
            const labelKey = HERO_NETWORK_LABEL_KEYS[id];
            if (labelKey === undefined) {
              return null;
            }
            return (
              <li key={id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={translate(labelKey)}
                  className={NETWORK_LINK_STYLES}
                >
                  <SocialIcon network={id} />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
