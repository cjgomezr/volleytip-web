import type { ReactElement } from "react";

/** El signo que acompaña al texto de error de un campo: el color solo no
 * basta. */
export function FieldErrorIcon(): ReactElement {
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
