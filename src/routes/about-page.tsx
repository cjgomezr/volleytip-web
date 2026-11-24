import type { ReactElement } from "react";

import { AboutHero } from "~/components/about-hero";
import {
  Characters,
  Founders,
  HowWeDoIt,
  OurStory,
  WorkTogether,
} from "~/components/about-sections";
import { StatsStrip } from "~/components/stats-strip";
import { CONTACT_REASON_BRANDS, getContactHref } from "~/lib/contact-link";
import type { Language } from "~/lib/i18n/languages";
import type { PageDeclaration } from "~/lib/i18n/page-path";
import { PAGES } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import type { SiteStat } from "~/lib/site-stats.server";

interface AboutPageProps {
  readonly stats: readonly SiteStat[];
  readonly language: Language;
  readonly cdnHost: string;
  /** El mapa de páginas donde se busca Contacto. Solo las pruebas lo cambian. */
  readonly pages?: readonly PageDeclaration[];
}

/** La página Nosotros (FR-052). */
export function AboutPage({
  stats,
  language,
  cdnHost,
  pages = PAGES,
}: AboutPageProps): ReactElement {
  const translate = useTranslate();

  return (
    <>
      <AboutHero cdnHost={cdnHost} />
      <StatsStrip
        stats={stats}
        pageLanguage={language}
        label={translate("about.stats.label")}
      />
      <HowWeDoIt />
      <OurStory />
      <Founders cdnHost={cdnHost} />
      <Characters cdnHost={cdnHost} />
      <WorkTogether
        contactHref={getContactHref(pages, language, CONTACT_REASON_BRANDS)}
      />
    </>
  );
}
