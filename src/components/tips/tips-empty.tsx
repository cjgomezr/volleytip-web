import type { ReactElement } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

import { Button } from "../button";
import { SocialNetworkLinks } from "../social-network-links";

const TEXT_STYLES = "m-0 max-w-[640px] text-[18px] leading-[1.5]";

/** Los filtros o la búsqueda no encuentran nada. */
export function NoMatchingTips(): ReactElement {
  const translate = useTranslate();
  return (
    <div className="flex flex-col items-start gap-6">
      <p className={TEXT_STYLES}>{translate("tips.noResults.text")}</p>
      <Button to="tips" variant="secondary">
        {translate("tips.noResults.clear")}
      </Button>
    </div>
  );
}

/** Todavía no hay ningún tip publicado. */
export function NoPublishedTips(): ReactElement {
  const translate = useTranslate();
  return (
    <div className="flex flex-col items-start gap-4">
      <p className={TEXT_STYLES}>{translate("tips.empty.text")}</p>
      <p className={`${TEXT_STYLES} text-ink-muted`}>
        {translate("tips.empty.follow")}
      </p>
      <SocialNetworkLinks />
    </div>
  );
}
