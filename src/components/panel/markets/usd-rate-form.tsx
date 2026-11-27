import { useState, type ReactElement } from "react";

import {
  MARKETS_FIELDS,
  type RateOutcome,
  type UsdRateView,
} from "~/lib/admin/markets";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { TextField } from "../../text-field";
import { SaveBar } from "../editor-section";
import { usePreloadSubmission } from "~/lib/panel/use-preload-submission";

const ERROR_KEYS = {
  required: "panel.markets.rate.error.required",
  notPositiveInteger: "panel.markets.rate.error.notPositiveInteger",
} as const satisfies Readonly<Record<string, MessageKey>>;

const STATE_KEYS = {
  missing: "panel.markets.rate.missing",
  invalid: "panel.markets.rate.invalid",
} as const satisfies Readonly<Record<string, MessageKey>>;

function CurrentRate({
  usdRate,
}: {
  readonly usdRate: UsdRateView;
}): ReactElement {
  const translate = useTranslate();
  const text =
    usdRate.state === "set"
      ? translate("panel.markets.rate.current", { rate: usdRate.value })
      : translate(STATE_KEYS[usdRate.state]);
  return <p className="mt-3 mb-0 text-[16px] font-bold">{text}</p>;
}

/** La tasa manual de pesos por dólar (FR-122). Es un campo de texto: uno
 * numérico del navegador se tragaría las letras sin avisar. */
export function UsdRateForm({
  usdRate,
  initialOutcome,
}: {
  readonly usdRate: UsdRateView;
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: RateOutcome;
}): ReactElement {
  const translate = useTranslate();
  const path = getPanelPath("adminMarketsRate", useLanguage());
  const fetcher = usePanelFetcher<RateOutcome>(initialOutcome);
  usePreloadSubmission("adminMarketsRate");
  const { outcome } = fetcher;
  const rejection = outcome?.status === "invalid" ? outcome : undefined;
  const [isEdited, setIsEdited] = useState(false);
  return (
    <>
      <CurrentRate usdRate={usdRate} />
      <fetcher.Form
        method="post"
        action={path}
        noValidate
        onInput={() => setIsEdited(true)}
        onSubmit={() => setIsEdited(false)}
        className="mt-4"
      >
        <div className="max-w-[360px]">
          <TextField
            zone="light"
            name={MARKETS_FIELDS.rate}
            label={translate("panel.markets.rate.label")}
            hint={translate("panel.markets.rate.hint")}
            defaultValue={rejection?.value ?? usdRate.value}
            error={rejection && translate(ERROR_KEYS[rejection.error])}
          />
        </div>
        <SaveBar
          submitLabel={translate("panel.markets.rate.save")}
          isSaving={fetcher.isSending}
          isEdited={isEdited}
          status={outcome?.status}
          isUnsent={fetcher.isUnsent}
        />
      </fetcher.Form>
    </>
  );
}
