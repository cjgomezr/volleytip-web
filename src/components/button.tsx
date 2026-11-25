import type { ReactElement, ReactNode } from "react";

import {
  isInert,
  isSubmitting,
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

export type ButtonVariant = "primary" | "secondary";

type ButtonProps = PressableTarget & {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly zone?: Zone;
};

// `min-h` y no `h`: un texto largo baja a otra línea en vez de salirse.
const SHARED_STYLES =
  "inline-flex max-w-full items-center justify-center gap-2 rounded-pill py-2 text-center leading-tight font-bold no-underline";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "min-h-[54px] bg-brand-red px-7 text-[17px] text-brand-night",
  secondary: "min-h-[50px] border-2 bg-transparent px-6 text-[16px]",
};

const ZONE_STYLES: Record<ButtonVariant, Record<Zone, string>> = {
  primary: { dark: "", light: "focused:outline-brand-night" },
  secondary: OUTLINE_ZONE_STYLES,
};

// El primario sigue la misma regla que el aspecto de contorno: hover lima en
// zona oscura y noche en zona clara; al presionar, niebla o índigo.
const INTERACTIVE_STYLES: Record<ButtonVariant, Record<Zone, string>> = {
  primary: {
    dark: "hovered:bg-brand-lime pressed:bg-brand-mist",
    light:
      "hovered:bg-brand-night hovered:text-brand-mist pressed:bg-brand-indigo pressed:text-brand-mist",
  },
  secondary: OUTLINE_INTERACTIVE_STYLES,
};

// En envío conserva el color: la persona acaba de presionarlo y lo está
// mirando. Lo que cambia es el indicador que gira.
const SUBMITTING_STYLES = "cursor-progress";
const SPINNER_STYLES =
  "size-4 shrink-0 animate-spin rounded-pill border-2 border-current border-t-transparent motion-reduce:animate-none";

function chooseStateStyles(
  target: PressableTarget,
  interactiveStyles: string,
): string {
  if (isSubmitting(target)) {
    return SUBMITTING_STYLES;
  }
  return isInert(target) ? DISABLED_STYLES : interactiveStyles;
}

function joinStyles(
  variant: ButtonVariant,
  zone: Zone,
  stateStyles: string,
): string {
  return [
    SHARED_STYLES,
    TRANSITION_STYLES,
    VARIANT_STYLES[variant],
    ZONE_STYLES[variant][zone],
    stateStyles,
  ]
    .filter((styles) => styles !== "")
    .join(" ");
}

/**
 * El aspecto del botón para un enlace a una dirección que no es una página
 * del sitio (las del panel), y que por eso `Button` no puede pintar.
 */
export function getButtonLinkClassName(
  variant: ButtonVariant,
  zone: Zone,
): string {
  return joinStyles(variant, zone, INTERACTIVE_STYLES[variant][zone]);
}

/**
 * Botón de texto. Con `to` es un enlace; sin `to` es un `<button>`.
 * El primario es la única acción principal de una pantalla.
 */
export function Button({
  children,
  variant = "primary",
  zone = "dark",
  ...target
}: ButtonProps): ReactElement {
  const stateStyles = chooseStateStyles(
    target,
    INTERACTIVE_STYLES[variant][zone],
  );
  return (
    <Pressable {...target} className={joinStyles(variant, zone, stateStyles)}>
      {isSubmitting(target) ? (
        <span aria-hidden="true" className={SPINNER_STYLES} />
      ) : null}
      {children}
    </Pressable>
  );
}
