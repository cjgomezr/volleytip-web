import { useId, useState, type ReactElement } from "react";
import { useFetcher } from "react-router";

import {
  MARKETS_FIELDS,
  type MarketOutcome,
  type PanelLanguage,
  type PanelMarket,
} from "~/lib/admin/markets";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { SaveBar } from "../editor-section";
import { MarketFields } from "./market-fields";
import { StatePill } from "./state-pill";

function useCountryName(code: string): string {
  const names = new Intl.DisplayNames([useLanguage()], { type: "region" });
  return names.of(code) ?? code;
}

/** Un mercado con su formulario. País y moneda no se editan. */
export function MarketForm({
  market,
  languages,
  initialOutcome,
}: {
  readonly market: PanelMarket;
  readonly languages: readonly PanelLanguage[];
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: MarketOutcome;
}): ReactElement {
  const translate = useTranslate();
  const path = getPanelPath("adminMarketsMarket", useLanguage());
  const country = useCountryName(market.countryCode);
  const headingId = useId();
  const fetcher = useFetcher<MarketOutcome>();
  const outcome = fetcher.data ?? initialOutcome;
  const rejection = outcome?.status === "invalid" ? outcome : undefined;
  const [isEdited, setIsEdited] = useState(false);
  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-card border-2 border-line-light p-3 md:p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="m-0 text-[18px] font-bold break-words">
          {translate("panel.markets.market.heading", {
            country,
            code: market.countryCode,
          })}
        </h3>
        <StatePill isActive={market.isActive} />
      </div>
      <p className="mt-1 mb-4 text-[14px] text-ink-subtle">
        {translate("panel.markets.market.currency", {
          currency: market.currency,
        })}
      </p>
      <fetcher.Form
        method="post"
        action={path}
        noValidate
        onChange={() => setIsEdited(true)}
        onSubmit={() => setIsEdited(false)}
      >
        <input type="hidden" name={MARKETS_FIELDS.id} value={market.id} />
        <MarketFields
          values={rejection?.values ?? market}
          rejection={rejection}
          languages={languages}
        />
        <SaveBar
          submitLabel={translate("panel.markets.market.save", {
            code: market.countryCode,
          })}
          isSaving={fetcher.state !== "idle"}
          isEdited={isEdited}
          status={outcome?.status}
          formError={
            rejection?.formError === "malformed"
              ? translate("panel.siteTexts.error.malformed")
              : undefined
          }
        />
      </fetcher.Form>
    </section>
  );
}
