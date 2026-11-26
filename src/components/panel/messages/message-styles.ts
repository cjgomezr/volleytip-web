import { TRANSITION_STYLES } from "../../pressable-styles";

/** Un enlace de texto sobre la zona clara del panel, con 44 px de alto. */
export const TEXT_LINK_STYLES = `inline-flex min-h-11 items-center text-[14px] font-bold text-brand-night underline hovered:text-brand-indigo pressed:text-brand-indigo focused:outline-brand-night ${TRANSITION_STYLES}`;

export const CARD_STYLES = "rounded-card bg-surface-light p-5 md:p-6";

/** El título de una tarjeta: pequeño y en mayúsculas, como en el mockup. */
export const CARD_TITLE_STYLES =
  "m-0 text-[12px] leading-[1.4] font-bold tracking-[0.12em] text-brand-night uppercase";
