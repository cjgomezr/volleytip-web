import { useId, type ReactElement } from "react";

import type { PreviewState, Zone } from "./pressable";
import { DISABLED_STYLES, TRANSITION_STYLES } from "./pressable-styles";

type TextFieldType =
  "text" | "email" | "tel" | "url" | "search" | "password" | "number";

interface TextFieldProps {
  /** Obligatoria: un campo sin etiqueta no es accesible. */
  readonly label: string;
  readonly name: string;
  readonly type?: TextFieldType;
  readonly autoComplete?: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  /** Texto de ayuda, debajo del campo. */
  readonly hint?: string;
  /** Mensaje de error. Vacío o ausente: el campo no tiene error. */
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
  readonly zone?: Zone;
  /** Para quien necesita seguir lo escrito; el campo sigue sin controlar. */
  readonly onChange?: (value: string) => void;
  /** Solo para la página de muestra (ver `PreviewState`). */
  readonly previewState?: Exclude<PreviewState, "active">;
}

// El campo es igual en las dos zonas: fondo blanco y texto noche. El texto
// de 16 px no baja nunca: con menos, iOS hace zoom al enfocarlo.
const INPUT_STYLES =
  "block h-[52px] w-full min-w-0 rounded-control border-2 bg-surface-light px-4 text-[16px] text-brand-night placeholder:text-ink-subtle";

// Hover como en los botones: lima en zona oscura. En zona clara el borde ya
// es noche, así que se engrosa hacia adentro: otro tono oscuro no se
// distinguiría.
const BORDER_STYLES: Record<Zone, string> = {
  dark: "border-brand-night hovered:border-brand-lime",
  light:
    "border-brand-night hovered:inset-ring-2 hovered:inset-ring-brand-night focused:outline-brand-night",
};

// Con error el borde no cambia al pasar el puntero: el error manda.
const ERROR_BORDER_STYLES: Record<Zone, string> = {
  dark: "border-brand-red",
  light: "border-brand-red-deep focused:outline-brand-night",
};

// El rojo de marca no alcanza contraste sobre niebla; por eso en zona clara
// el error va en rojo profundo.
const ERROR_TEXT_STYLES: Record<Zone, string> = {
  dark: "text-brand-red",
  light: "text-brand-red-deep",
};

const HINT_STYLES: Record<Zone, string> = {
  dark: "text-ink-muted",
  light: "text-ink-subtle",
};

function ErrorIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="mt-0.5 shrink-0"
    >
      <circle cx="8" cy="8" r="7" />
      <path d="M8 4.5v4M8 11.2v.3" />
    </svg>
  );
}

function hasText(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== "";
}

/**
 * Campo de texto con su etiqueta, su ayuda y su error. El campo queda
 * enlazado a los tres para lectores de pantalla.
 */
export function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  placeholder,
  hint,
  error,
  isRequired = false,
  isDisabled = false,
  zone = "dark",
  previewState,
  onChange,
}: TextFieldProps): ReactElement {
  const id = useId();
  const hintId = hasText(hint) ? `${id}-hint` : undefined;
  const errorId = hasText(error) ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(
    (describerId) => describerId !== undefined,
  );
  const borderStyles =
    errorId === undefined ? BORDER_STYLES[zone] : ERROR_BORDER_STYLES[zone];
  const stateStyles = isDisabled ? DISABLED_STYLES : "";

  return (
    <div className="w-full min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[14px] font-bold break-words"
      >
        {label}
        {/* El asterisco es para quien ve; a un lector de pantalla se lo dice
            el atributo `required`. */}
        {isRequired ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={isRequired}
        disabled={isDisabled}
        aria-invalid={errorId === undefined ? undefined : "true"}
        aria-describedby={
          describedBy.length === 0 ? undefined : describedBy.join(" ")
        }
        data-preview={previewState}
        onChange={onChange && ((event) => onChange(event.currentTarget.value))}
        className={`${INPUT_STYLES} ${TRANSITION_STYLES} ${borderStyles} ${stateStyles}`}
      />
      {hintId === undefined ? null : (
        <p
          id={hintId}
          className={`mt-2 text-[13px] break-words ${HINT_STYLES[zone]}`}
        >
          {hint}
        </p>
      )}
      {errorId === undefined ? null : (
        <p
          id={errorId}
          className={`mt-2 flex items-start gap-2 text-[14px] font-semibold ${ERROR_TEXT_STYLES[zone]}`}
        >
          <ErrorIcon />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}
    </div>
  );
}
