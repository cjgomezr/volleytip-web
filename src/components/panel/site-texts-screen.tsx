import type { ReactElement } from "react";

import type {
  BarOutcome,
  SiteTextsView,
  StatsOutcome,
} from "~/lib/admin/site-texts";
import { useTranslate } from "~/lib/i18n/translations-context";

import { AnnouncementEditor } from "./announcement-editor";
import { PanelHeading } from "./panel-heading";
import { StatsEditor } from "./stats-editor";

export interface SiteTextsScreenProps extends SiteTextsView {
  readonly barOutcome?: BarOutcome;
  readonly statsOutcome?: StatsOutcome;
}

/** "Textos del sitio" (FR-065): lo que el sitio público lee de la base y el
 * admin puede cambiar. Va dentro de `PanelShell`. */
export function SiteTextsScreen({
  bar,
  stats,
  limits,
  barOutcome,
  statsOutcome,
}: SiteTextsScreenProps): ReactElement {
  const translate = useTranslate();
  return (
    <div className="max-w-[900px]">
      <PanelHeading title={translate("panel.module.siteTexts")} />
      <AnnouncementEditor
        bar={bar}
        limits={limits}
        initialOutcome={barOutcome}
      />
      <StatsEditor
        stats={stats}
        limits={limits}
        initialOutcome={statsOutcome}
      />
    </div>
  );
}
