import type { ReactElement } from "react";

import { formatNumber } from "~/lib/i18n/format";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import type { UsdApproximation } from "~/lib/usd-approximation";

interface PriceApproximationProps {
  readonly approximation: UsdApproximation;
}

/**
 * El aproximado en dólares que va debajo de un precio en pesos, con la nota
 * de que el cobro es en pesos. Toma el color del texto de su zona. Sin
 * aproximado no pinta nada. El lector de pantalla lee una frase completa,
 * no el símbolo `≈`.
 */
export function PriceApproximation({
  approximation,
}: PriceApproximationProps): ReactElement | null {
  const translate = useTranslate();
  const language = useLanguage();
  if (approximation.kind === "none") return null;

  const isExact = approximation.kind === "approximate";
  const visibleText = isExact
    ? translate("priceApproximation.about", {
        amount: formatNumber(approximation.dollars, language),
      })
    : translate("priceApproximation.lessThanOne");
  const spokenText = isExact
    ? translate("priceApproximation.spoken", { count: approximation.dollars })
    : translate("priceApproximation.spokenLessThanOne");

  return (
    <p className="text-[14px] leading-[1.4]">
      <span aria-hidden="true">{visibleText}</span>
      <span className="sr-only">{spokenText}</span>{" "}
      <span>{translate("priceApproximation.chargeNote")}</span>
    </p>
  );
}
