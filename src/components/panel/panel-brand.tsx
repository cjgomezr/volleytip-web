import type { ReactElement } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

/** El logo con la marca de "Admin". */
export function PanelBrand(): ReactElement {
  const translate = useTranslate();
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/brand/wordmark.png"
        alt={translate("panel.brand")}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        className="h-5 w-auto md:h-6"
      />
      <span className="rounded-pill bg-brand-lime px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-brand-night uppercase">
        {translate("panel.badge")}
      </span>
    </div>
  );
}
