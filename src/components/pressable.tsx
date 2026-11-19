import type { MouseEvent, ReactElement, ReactNode } from "react";
import { Link } from "react-router";

/** Zona de la página donde se pinta el componente. El sitio es oscuro por
 * defecto; tienda, carrito, checkout y admin son zonas claras. */
export type Zone = "dark" | "light";

/**
 * Fuerza la apariencia de un estado que normalmente depende del puntero o del
 * teclado. Existe solo para que la página de muestra enseñe todos los estados
 * a la vez y Playwright los capture. Ninguna pantalla real lo usa.
 */
export type PreviewState = "hover" | "focus" | "active";

interface SharedTarget {
  readonly isDisabled?: boolean;
  readonly previewState?: PreviewState;
  readonly "aria-label"?: string;
}

/** Con destino: se pinta como enlace. */
export interface LinkTarget extends SharedTarget {
  readonly to: string;
}

/** Sin destino: se pinta como `<button>`. */
export interface ActionTarget extends SharedTarget {
  readonly to?: undefined;
  readonly type?: "button" | "submit";
  readonly onClick?: () => void;
  /**
   * Presente mientras la acción está en curso. El botón queda deshabilitado
   * y este texto se anuncia a lectores de pantalla.
   */
  readonly submittingLabel?: string;
}

export type PressableTarget = LinkTarget | ActionTarget;

type PressableProps = PressableTarget & {
  readonly className: string;
  readonly children: ReactNode;
};

/** Dice si el control no debe reaccionar: deshabilitado o con un envío en curso. */
export function isInert(target: PressableTarget): boolean {
  if (target.isDisabled === true) {
    return true;
  }
  return target.to === undefined && target.submittingLabel !== undefined;
}

function PressableLink({
  to,
  isDisabled = false,
  previewState,
  className,
  children,
  "aria-label": ariaLabel,
}: LinkTarget & Pick<PressableProps, "className" | "children">): ReactElement {
  if (isDisabled) {
    // Un enlace no tiene atributo `disabled`. Sin `href` deja de ser
    // navegable y `aria-disabled` lo anuncia.
    return (
      <a
        role="link"
        aria-disabled="true"
        aria-label={ariaLabel}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      data-preview={previewState}
      className={className}
    >
      {children}
    </Link>
  );
}

function PressableAction({
  type = "button",
  onClick,
  submittingLabel,
  isDisabled = false,
  previewState,
  className,
  children,
  "aria-label": ariaLabel,
}: ActionTarget &
  Pick<PressableProps, "className" | "children">): ReactElement {
  const isSubmitting = submittingLabel !== undefined;

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    if (isSubmitting) {
      // Evita un segundo envío del formulario mientras el primero sigue.
      event.preventDefault();
      return;
    }
    onClick?.();
  }

  return (
    <>
      {/* En envío se usa `aria-disabled` y no `disabled`: un botón con
          `disabled` pierde el foco, y quien navega con teclado queda sin
          saber dónde está. */}
      <button
        type={type}
        disabled={isDisabled}
        aria-disabled={isSubmitting ? "true" : undefined}
        aria-busy={isSubmitting ? "true" : undefined}
        aria-label={ariaLabel}
        data-preview={previewState}
        onClick={handleClick}
        className={className}
      >
        {children}
      </button>
      {/* Va fuera del botón porque el contenido de un botón no se anuncia
          como región viva, y existe desde antes del envío porque un lector
          de pantalla solo anuncia cambios en regiones que ya conocía. */}
      <span role="status" className="sr-only">
        {submittingLabel}
      </span>
    </>
  );
}

/**
 * Base de los botones: decide entre enlace y `<button>` según haya destino.
 * No trae estilos propios; los pone quien lo usa.
 */
export function Pressable(props: PressableProps): ReactElement {
  if (props.to !== undefined) {
    return <PressableLink {...props} />;
  }
  return <PressableAction {...props} />;
}
