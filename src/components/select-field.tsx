import { useId, type ReactElement } from "react";

import type { Zone } from "./pressable";
import { TRANSITION_STYLES } from "./pressable-styles";

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  /** Obligatoria: un campo sin etiqueta no es accesible. */
  readonly label: string;
  readonly name: string;
  readonly options: readonly SelectOption[];
  readonly defaultValue?: string;
  readonly autoComplete?: string;
  /** Mensaje de error. Vacío o ausente: el campo no tiene error. */
  readonly error?: string;
  readonly zone?: Zone;
}

// Mismas medidas y bordes que `TextField`: los dos campos van juntos en un
// formulario y tienen que verse como uno solo.
const SELECT_STYLES =
  "block h-[52px] w-full min-w-0 rounded-control border-2 bg-surface-light px-4 text-[16px] text-brand-night";

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

/** Lista desplegable nativa con su etiqueta y su error, enlazados a lectores
 * de pantalla. Es la nativa a propósito: funciona con teclado y sin
 * JavaScript. */
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  autoComplete,
  error,
  zone = "dark",
}: SelectFieldProps): ReactElement {
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
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={errorId}
        className={`${SELECT_STYLES} ${TRANSITION_STYLES} ${borderStyles}`}
      >
        {options.map(({ value, label: optionLabel }) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
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
