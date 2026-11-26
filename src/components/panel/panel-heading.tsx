import type { ReactElement } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

import { Eyebrow } from "../eyebrow";

/** El encabezado de una pantalla del panel, con el título del documento. */
export function PanelHeading({
  title,
  documentTitle = title,
  isLongTitle = false,
}: {
  readonly title: string;
  /** El de la pestaña, cuando no es el mismo que se lee en la pantalla. */
  readonly documentTitle?: string;
  /** Con un correo en el título: más pequeño, para que no se parta. */
  readonly isLongTitle?: boolean;
}): ReactElement {
  const translate = useTranslate();
  const size = isLongTitle ? "text-[26px] md:text-[36px]" : "text-[44px]";
  return (
    <div className="text-ink-subtle">
      <title>{documentTitle}</title>
      <Eyebrow text={translate("panel.eyebrow")} />
      <h1
        className={`mt-2.5 font-display leading-[0.95] text-brand-night uppercase [overflow-wrap:anywhere] ${size}`}
      >
        {title}
      </h1>
    </div>
  );
}
