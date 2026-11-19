import type { ReactElement, ReactNode } from "react";

import {
  isInert,
  Pressable,
  type PressableTarget,
  type Zone,
} from "./pressable";

type IconButtonProps = PressableTarget & {
  /** Obligatorio: un botón de solo ícono no tiene otro nombre accesible. */
  readonly "aria-label": string;
  /** El ícono. Debe ir con `aria-hidden`: el nombre lo da `aria-label`. */
  readonly children: ReactNode;
  readonly zone?: Zone;
};

// 44 px es también el mínimo de zona de toque en celular.
const SHARED_STYLES =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-pill border-2 bg-transparent transition-colors motion-reduce:transition-none";

const ZONE_STYLES: Record<Zone, string> = {
  dark: "border-brand-mist text-brand-mist",
  light: "border-brand-night text-brand-night focused:outline-brand-night",
};

// Mismos estados que el botón secundario.
const INTERACTIVE_STYLES: Record<Zone, string> = {
  dark: "hovered:border-brand-lime hovered:text-brand-lime pressed:border-brand-mist pressed:bg-brand-mist pressed:text-brand-night",
  light:
    "hovered:bg-brand-night hovered:text-brand-mist pressed:border-brand-indigo pressed:bg-brand-indigo pressed:text-brand-mist",
};

const INERT_STYLES = "cursor-not-allowed opacity-50";

/** Botón circular de solo ícono. Con `to` es un enlace; sin `to`, un `<button>`. */
export function IconButton({
  children,
  zone = "dark",
  ...target
}: IconButtonProps): ReactElement {
  const stateStyles = isInert(target) ? INERT_STYLES : INTERACTIVE_STYLES[zone];

  return (
    <Pressable
      {...target}
      className={`${SHARED_STYLES} ${ZONE_STYLES[zone]} ${stateStyles}`}
    >
      {children}
    </Pressable>
  );
}
