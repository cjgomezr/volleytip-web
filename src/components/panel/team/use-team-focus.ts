import { useEffect, useRef, type RefObject } from "react";

import type { MemberOutcome } from "~/lib/admin/team";

function hasLostFocus(): boolean {
  const focused = document.activeElement;
  return (
    focused === null ||
    focused === document.body ||
    focused.matches(":disabled")
  );
}

/**
 * Después de un envío, el botón que tenía el foco se deshabilitó, cambió por
 * otro o su fila se movió: quien usa el teclado quedaría sin saber dónde está.
 * Lo deja en el primer control de esa fila. Devuelve el ref de la lista donde
 * se busca.
 */
export function useTeamFocus(
  outcome: MemberOutcome | undefined,
): RefObject<HTMLUListElement | null> {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (outcome === undefined || !hasLostFocus()) return;
    const control = listRef.current?.querySelector<HTMLElement>(
      `[data-member-row="${outcome.memberId}"] :is(button:not(:disabled), a[href])`,
    );
    control?.focus();
    // Al mover el nodo el navegador no siempre lo sigue, y en celular queda
    // fuera de la pantalla o bajo la barra inferior.
    control?.scrollIntoView({ block: "nearest" });
  }, [outcome]);
  return listRef;
}
