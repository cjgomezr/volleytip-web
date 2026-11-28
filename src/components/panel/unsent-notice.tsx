import type { ReactElement } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

import type { Zone } from "../pressable";

// El rojo oscuro solo se lee sobre claro. En el menú y el encabezado del
// panel el texto va claro y el rojo queda en el borde.
const ZONE_STYLES: Record<Zone, string> = {
  light: "text-brand-red-deep",
  dark: "rounded-control border-2 border-brand-red px-3 py-2 text-brand-mist",
};

/** El envío no llegó al servidor. No dice que quedó registrado: el servidor
 * no se enteró. */
export function UnsentNotice({
  zone = "light",
}: {
  readonly zone?: Zone;
}): ReactElement {
  const translate = useTranslate();
  return (
    <p
      role="alert"
      className={`m-0 text-[15px] leading-[1.5] font-bold ${ZONE_STYLES[zone]}`}
    >
      {translate("panel.unsent")}
    </p>
  );
}
