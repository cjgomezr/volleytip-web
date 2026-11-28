import { useEffect, useRef, type RefObject } from "react";

/** Los dos lugares de una fila: el del rol y el de dar o quitar el acceso. */
export type TeamControl = "role" | "access";

export interface SentControl {
  readonly memberId: string;
  readonly control: TeamControl;
}

function hasLostFocus(): boolean {
  const focused = document.activeElement;
  return (
    focused === null ||
    focused === document.body ||
    focused.matches(":disabled")
  );
}

/**
 * Después de un envío deja a la vista lo que se avisa en la fila. Y si el
 * botón que tenía el foco se deshabilitó o cambió por otro, lo pone en el que
 * quedó en su lugar: quien usa el teclado quedaría sin saber dónde está, y en
 * otro lugar un segundo Enter haría un cambio que no pidió. Devuelve el ref de
 * la lista donde se busca.
 */
export function useTeamFocus(
  /** La respuesta del último envío, ya terminado. */
  answer: object | undefined,
  sent: SentControl | undefined,
): RefObject<HTMLUListElement | null> {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (answer === undefined || sent === undefined) return;
    const row = listRef.current?.querySelector(
      `[data-member-row="${sent.memberId}"]`,
    );
    if (hasLostFocus()) {
      const place = `[data-team-control="${sent.control}"]`;
      row?.querySelector<HTMLElement>(`a${place}, ${place} button`)?.focus();
    }
    row
      ?.querySelector("[data-member-feedback]")
      ?.scrollIntoView({ block: "nearest" });
  }, [answer, sent]);
  return listRef;
}
