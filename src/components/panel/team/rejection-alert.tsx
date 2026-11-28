import type { ReactElement } from "react";

import { FieldErrorIcon } from "../../field-error-icon";

/** Por qué no se hizo un cambio, anunciado a lectores de pantalla. */
export function RejectionAlert({
  text,
}: {
  readonly text: string;
}): ReactElement {
  return (
    <p
      role="alert"
      className="m-0 flex items-start gap-2 text-[15px] leading-[1.5] font-bold text-brand-red-deep"
    >
      <FieldErrorIcon />
      <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
    </p>
  );
}
