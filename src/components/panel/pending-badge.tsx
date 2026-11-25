import type { ReactElement } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

const BADGE_STYLES =
  "inline-flex shrink-0 items-center justify-center rounded-pill bg-brand-red px-2 py-0.5 text-[11px] leading-[1.4] font-bold text-brand-night";

/** El número de pendientes de una entrada. El lector de pantalla oye además
 * de qué es el número. */
export function PendingBadge({
  count,
  className,
}: {
  readonly count: number;
  /** El ancho y la posición, que dependen de dónde va. */
  readonly className: string;
}): ReactElement {
  const translate = useTranslate();
  return (
    <span data-panel-badge className={`${BADGE_STYLES} ${className}`}>
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {translate("panel.nav.pending", { count })}
      </span>
    </span>
  );
}
