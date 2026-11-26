import type { ReactElement } from "react";

interface MarketCheckboxProps {
  readonly name: string;
  readonly label: string;
  readonly value?: string;
  readonly isChecked: boolean;
  /** El id del texto que explica el error de esta casilla, si lo tiene. */
  readonly errorId?: string;
}

// Casillas nativas: funcionan con teclado y sin JavaScript. La zona de toque
// es toda la etiqueta.
export function MarketCheckbox({
  name,
  label,
  value = "true",
  isChecked,
  errorId,
}: MarketCheckboxProps): ReactElement {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[16px]">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={isChecked}
        aria-invalid={errorId === undefined ? undefined : "true"}
        aria-describedby={errorId}
        className="m-0 size-5 shrink-0 cursor-pointer accent-brand-night focused:outline-brand-night"
      />
      {label}
    </label>
  );
}

export function FieldError({
  id,
  text,
}: {
  readonly id: string;
  readonly text: string;
}): ReactElement {
  return (
    <p
      id={id}
      className="m-0 text-[14px] leading-[1.5] font-semibold text-brand-red-deep"
    >
      {text}
    </p>
  );
}
