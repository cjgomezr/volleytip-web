import type { ReactElement, ReactNode } from "react";

import {
  isInert,
  isSubmitting,
  Pressable,
  type PressableTarget,
  type Zone,
} from "./pressable";

export type ButtonVariant = "primary" | "secondary";

type ButtonProps = PressableTarget & {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly zone?: Zone;
};

// `min-h` y no `h`: un texto largo baja a otra línea en vez de salirse.
const SHARED_STYLES =
  "inline-flex max-w-full items-center justify-center gap-2 rounded-pill py-2 text-center leading-tight font-bold no-underline transition-colors motion-reduce:transition-none";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "min-h-[54px] bg-brand-red px-7 text-[17px] text-brand-night",
  secondary: "min-h-[50px] border-2 bg-transparent px-6 text-[16px]",
};

// El secundario toma el color del texto de su zona.
const ZONE_STYLES: Record<ButtonVariant, Record<Zone, string>> = {
  primary: { dark: "", light: "focused:outline-brand-night" },
  secondary: {
    dark: "border-brand-mist text-brand-mist",
    light: "border-brand-night text-brand-night focused:outline-brand-night",
  },
};

// Hover como en los enlaces de los mockups: lima en zona oscura, noche en
// zona clara. Al presionar se rellena: niebla en zona oscura, índigo en zona
// clara.
const INTERACTIVE_STYLES: Record<ButtonVariant, Record<Zone, string>> = {
  primary: {
    dark: "hovered:bg-brand-lime pressed:bg-brand-mist",
    light:
      "hovered:bg-brand-night hovered:text-brand-mist pressed:bg-brand-indigo pressed:text-brand-mist",
  },
  secondary: {
    dark: "hovered:border-brand-lime hovered:text-brand-lime pressed:border-brand-mist pressed:bg-brand-mist pressed:text-brand-night",
    light:
      "hovered:bg-brand-night hovered:text-brand-mist pressed:border-brand-indigo pressed:bg-brand-indigo pressed:text-brand-mist",
  },
};

const DISABLED_STYLES = "cursor-not-allowed opacity-50";
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
  const className = [
    SHARED_STYLES,
    VARIANT_STYLES[variant],
    ZONE_STYLES[variant][zone],
    stateStyles,
  ]
    .filter((styles) => styles !== "")
    .join(" ");

  return (
    <Pressable {...target} className={className}>
      {isSubmitting(target) ? (
        <span aria-hidden="true" className={SPINNER_STYLES} />
      ) : null}
      {children}
    </Pressable>
  );
}
