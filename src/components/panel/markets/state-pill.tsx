import type { ReactElement } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

// El color acompaña al texto, que es el que dice el estado. Sobre lima el
// texto va en noche.
export function StatePill({
  isActive,
}: {
  readonly isActive: boolean;
}): ReactElement {
  const translate = useTranslate();
  return (
    <span
      data-active={isActive}
      className={`rounded-pill px-3 py-1 text-[13px] font-bold text-brand-night ${isActive ? "bg-brand-lime" : "bg-line-light"}`}
    >
      {translate(
        isActive
          ? "panel.markets.state.active"
          : "panel.markets.state.inactive",
      )}
    </span>
  );
}
