import { useId, type ReactElement } from "react";

import type { Zone } from "./pressable";
import { TRANSITION_STYLES } from "./pressable-styles";

interface TextAreaFieldProps {
  /** Obligatoria: un campo sin etiqueta no es accesible. */
  readonly label: string;
  readonly name: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  /** Mensaje de error. Vacío o ausente: el campo no tiene error. */
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly rows?: number;
  readonly zone?: Zone;
}

const DEFAULT_ROWS = 5;

// Mismos bordes y colores que `TextField`; el alto lo da `rows`. Con 16 px
// de texto iOS no hace zoom al enfocarlo.
const AREA_STYLES =
  "block w-full min-w-0 resize-y rounded-control border-2 bg-surface-light px-4 py-3.5 text-[16px] text-brand-night placeholder:text-ink-subtle";

const BORDER_STYLES: Record<Zone, string> = {
  dark: "border-brand-night hovered:border-brand-lime",
  light:
    "border-brand-night hovered:inset-ring-2 hovered:inset-ring-brand-night focused:outline-brand-night",
};

const ERROR_BORDER_STYLES: Record<Zone, string> = {
  dark: "border-brand-red",
  light: "border-brand-red-deep focused:outline-brand-night",
};

const ERROR_TEXT_STYLES: Record<Zone, string> = {
  dark: "text-brand-red",
  light: "text-brand-red-deep",
};

/** Campo de texto de varias líneas con su etiqueta y su error, enlazados a
 * lectores de pantalla. Hermano de `TextField`. */
export function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
  error,
  isRequired = false,
  rows = DEFAULT_ROWS,
  zone = "dark",
}: TextAreaFieldProps): ReactElement {
  const id = useId();
  const hasError = error !== undefined && error.trim() !== "";
  const errorId = hasError ? `${id}-error` : undefined;
  const borderStyles = hasError
    ? ERROR_BORDER_STYLES[zone]
    : BORDER_STYLES[zone];

  return (
    <div className="w-full min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[14px] font-bold break-words"
      >
        {label}
        {isRequired ? <span aria-hidden="true"> *</span> : null}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={isRequired}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={errorId}
        className={`${AREA_STYLES} ${TRANSITION_STYLES} ${borderStyles}`}
      />
      {errorId === undefined ? null : (
        <p
          id={errorId}
          className={`mt-2 text-[14px] font-semibold break-words ${ERROR_TEXT_STYLES[zone]}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
