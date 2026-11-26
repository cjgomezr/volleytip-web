import type { ReactElement } from "react";

import type {
  LanguageOutcome,
  MarketOutcome,
  MarketsView,
  RateOutcome,
} from "~/lib/admin/markets";
import { useTranslate } from "~/lib/i18n/translations-context";

import { EditorSection } from "../editor-section";
import { PanelHeading } from "../panel-heading";
import { LanguageRow } from "./language-row";
import { MarketForm } from "./market-form";
import { UsdRateForm } from "./usd-rate-form";

export interface MarketsScreenProps extends MarketsView {
  /** Las respuestas de un envío sin JavaScript. */
  readonly languageOutcome?: LanguageOutcome;
  readonly marketOutcome?: MarketOutcome;
  readonly rateOutcome?: RateOutcome;
}

/** "Idiomas y mercados" (FR-065, FR-009, FR-122). Va dentro de `PanelShell`.
 * Solo edita lo que existe: no crea ni borra idiomas o mercados. */
export function MarketsScreen({
  languages,
  markets,
  usdRate,
  languageOutcome,
  marketOutcome,
  rateOutcome,
}: MarketsScreenProps): ReactElement {
  const translate = useTranslate();
  return (
    <div className="max-w-[900px]">
      <PanelHeading title={translate("panel.module.markets")} />
      <EditorSection
        id="markets-languages"
        title={translate("panel.markets.languages.title")}
        intro={translate("panel.markets.languages.intro")}
      >
        <ul className="mt-4 mb-0 flex list-none flex-col gap-3 p-0">
          {languages.map((language) => (
            <LanguageRow
              key={language.code}
              language={language}
              initialOutcome={
                languageOutcome?.code === language.code
                  ? languageOutcome
                  : undefined
              }
            />
          ))}
        </ul>
      </EditorSection>
      <EditorSection
        id="markets-markets"
        title={translate("panel.markets.markets.title")}
        intro={translate("panel.markets.markets.intro")}
      >
        {markets.map((market) => (
          <MarketForm
            key={market.id}
            market={market}
            languages={languages}
            initialOutcome={
              marketOutcome?.id === market.id ? marketOutcome : undefined
            }
          />
        ))}
      </EditorSection>
      <EditorSection
        id="markets-rate"
        title={translate("panel.markets.rate.title")}
        intro={translate("panel.markets.rate.intro")}
      >
        <UsdRateForm usdRate={usdRate} initialOutcome={rateOutcome} />
      </EditorSection>
    </div>
  );
}
