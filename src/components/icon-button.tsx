import type { ReactElement, ReactNode } from "react";

import {
  isInert,
  Pressable,
  type PressableTarget,
  type Zone,
} from "./pressable";
import {
  DISABLED_STYLES,
  OUTLINE_INTERACTIVE_STYLES,
  OUTLINE_ZONE_STYLES,
  TRANSITION_STYLES,
} from "./pressable-styles";

type IconButtonProps = PressableTarget & {
  /** Obligatorio: un botón de solo ícono no tiene otro nombre accesible. */
  readonly "aria-label": string;
  /** El ícono. Debe ir con `aria-hidden`: el nombre lo da `aria-label`. */
  readonly children: ReactNode;
  readonly zone?: Zone;
};

// 44 px es también el mínimo de zona de toque en celular.
const SHARED_STYLES =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-pill border-2 bg-transparent";

/** Botón circular de solo ícono. Con `to` es un enlace; sin `to`, un `<button>`. */
export function IconButton({
  children,
  zone = "dark",
  ...target
}: IconButtonProps): ReactElement {
  const stateStyles = isInert(target)
    ? DISABLED_STYLES
    : OUTLINE_INTERACTIVE_STYLES[zone];

  return (
    <Pressable
      {...target}
      className={`${SHARED_STYLES} ${TRANSITION_STYLES} ${OUTLINE_ZONE_STYLES[zone]} ${stateStyles}`}
    >
      {children}
    </Pressable>
  );
}
