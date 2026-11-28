import { useEffect, useRef, type RefObject } from "react";

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
 * botón que tenía el foco se deshabilitó o cambió por otro, lo pone en el
 * primer control de la fila: quien usa el teclado quedaría sin saber dónde
 * está. Devuelve el ref de la lista donde se busca.
 */
export function useTeamFocus(
  /** La respuesta del último envío, ya terminado. */
  answer: object | undefined,
  memberId: string | undefined,
): RefObject<HTMLUListElement | null> {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (answer === undefined || memberId === undefined) return;
    const row = listRef.current?.querySelector(
      `[data-member-row="${memberId}"]`,
    );
    if (hasLostFocus()) {
      row
        ?.querySelector<HTMLElement>("button:not(:disabled), a[href]")
        ?.focus();
    }
    row
      ?.querySelector("[data-member-feedback]")
      ?.scrollIntoView({ block: "nearest" });
  }, [answer, memberId]);
  return listRef;
}
