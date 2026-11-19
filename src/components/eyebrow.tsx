import type { ReactElement } from "react";

interface EyebrowProps {
  readonly text: string;
}

/**
 * Rótulo corto encima de un título. Toma el color del texto de su zona.
 * Con un texto vacío no pinta nada.
 */
export function Eyebrow({ text }: EyebrowProps): ReactElement | null {
  if (text.trim() === "") {
    return null;
  }
  return (
    <p className="text-[12px] font-bold tracking-[0.12em] break-words uppercase">
      {text}
    </p>
  );
}
