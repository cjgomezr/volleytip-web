import type { ReactElement } from "react";

import { FAQ_STATUS_LABEL_KEYS, type FaqStatus } from "~/lib/admin/faqs";
import { useTranslate } from "~/lib/i18n/translations-context";

// El color acompaña al texto, que es el que dice el estado. Sobre lima el
// texto va en noche.
const STATUS_STYLES: Record<FaqStatus, string> = {
  draft: "bg-brand-mist text-brand-night",
  published: "bg-brand-lime text-brand-night",
  retired: "bg-brand-night text-brand-mist",
};

export function FaqStatusBadge({
  status,
}: {
  readonly status: FaqStatus;
}): ReactElement {
  const translate = useTranslate();
  return (
    <span
      data-faq-status={status}
      className={`inline-block rounded-pill px-3 py-1 text-[13px] leading-[1.4] font-bold ${STATUS_STYLES[status]}`}
    >
      {translate(FAQ_STATUS_LABEL_KEYS[status])}
    </span>
  );
}
