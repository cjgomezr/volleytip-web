import type { Zone } from "./pressable";

// Estilos que comparten todos los botones. Un cambio aquí llega a todos:
// el botón de texto y el de ícono los toman de este archivo.

/** Cómo cambian de color al pasar de un estado a otro. */
export const TRANSITION_STYLES =
  "transition-colors motion-reduce:transition-none";

/** Deshabilitado: el mismo control, apagado. */
export const DISABLED_STYLES = "cursor-not-allowed opacity-50";

/**
 * Aspecto "de contorno": borde y texto del color del texto de la zona, sin
 * relleno. Lo usan el botón secundario y el botón de ícono. En zona clara el
 * anillo de foco pasa a brand-night.
 */
export const OUTLINE_ZONE_STYLES: Record<Zone, string> = {
  dark: "border-brand-mist text-brand-mist",
  light: "border-brand-night text-brand-night focused:outline-brand-night",
};

/**
 * Hover y activo del aspecto de contorno. Hover como en los enlaces de los
 * mockups: lima en zona oscura, noche en zona clara. Al presionar se rellena:
 * niebla en zona oscura, índigo en zona clara.
 */
export const OUTLINE_INTERACTIVE_STYLES: Record<Zone, string> = {
  dark: "hovered:border-brand-lime hovered:text-brand-lime pressed:border-brand-mist pressed:bg-brand-mist pressed:text-brand-night",
  light:
    "hovered:bg-brand-night hovered:text-brand-mist pressed:border-brand-indigo pressed:bg-brand-indigo pressed:text-brand-mist",
};
