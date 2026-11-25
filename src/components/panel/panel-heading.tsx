import type { ReactElement } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

import { Eyebrow } from "../eyebrow";

/** El encabezado de una pantalla del panel, con el título del documento. */
export function PanelHeading({
  title,
}: {
  readonly title: string;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className="text-ink-subtle">
      <title>{title}</title>
      <Eyebrow text={translate("panel.eyebrow")} />
      <h1 className="mt-1 font-display text-[44px] leading-[0.95] text-brand-night uppercase [overflow-wrap:anywhere]">
        {title}
      </h1>
    </div>
  );
}
