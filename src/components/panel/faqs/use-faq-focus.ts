import { useEffect, useRef, type RefObject } from "react";

import type { FaqListOutcome } from "~/lib/admin/faqs";

function wantedControls(
  outcome: FaqListOutcome,
): readonly ("up" | "down" | "status")[] {
  if (outcome.status === "unchanged") return ["up", "down", "status"];
  if (outcome.status !== "moved") return ["status"];
  // En un extremo su botón queda deshabilitado: sirve el contrario.
  return outcome.direction === "up" ? ["up", "down"] : ["down", "up"];
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
 * Después de un envío, el botón que tenía el foco se movió con su pregunta, se
 * deshabilitó o cambió de nombre: quien usa el teclado quedaría sin saber
 * dónde está. Devuelve el ref de la lista donde se busca.
 */
export function useFaqFocus(
  outcome: FaqListOutcome | undefined,
): RefObject<HTMLOListElement | null> {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (outcome === undefined) return;
    // Un "sin cambios" no dice qué botón fue: el foco se queda donde está,
    // salvo que la lista nueva haya apagado ese botón.
    if (outcome.status === "unchanged" && !hasLostFocus()) return;
    const row = `[data-faq-row="${outcome.faqId}"]`;
    for (const control of wantedControls(outcome)) {
      const button = listRef.current?.querySelector<HTMLElement>(
        `${row} [data-faq-action="${control}"] button:not(:disabled)`,
      );
      if (button) {
        button.focus();
        // Al mover el nodo el navegador no siempre lo sigue, y en celular
        // queda fuera de la pantalla o bajo la barra inferior.
        button.scrollIntoView({ block: "nearest" });
        return;
      }
    }
  }, [outcome]);
  return listRef;
}
