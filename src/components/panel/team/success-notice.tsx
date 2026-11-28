import type { ReactElement } from "react";

/** Lo que salió bien. La región existe siempre: un lector de pantalla solo
 * anuncia lo que cambia dentro de una región que ya estaba en la página. */
export function SuccessNotice({
  text,
}: {
  readonly text?: string;
}): ReactElement {
  return (
    <div role="status">
      {text === undefined ? null : (
        <p className="m-0 flex w-fit max-w-full items-start gap-2 rounded-card bg-brand-lime px-4 py-2 text-[15px] leading-[1.5] font-bold text-brand-night [overflow-wrap:anywhere]">
          <span aria-hidden="true">✓</span>
          {text}
        </p>
      )}
    </div>
  );
}
