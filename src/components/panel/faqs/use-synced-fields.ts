import { useEffect, useRef, type RefObject } from "react";

import { faqField, type FaqPart, type FaqText } from "~/lib/admin/faqs";

const PARTS = ["question", "answer"] as const satisfies readonly FaqPart[];

// El navegador puede devolver otros saltos y el servidor quita los espacios de
// las orillas: eso no es haber escrito algo distinto.
function isSameText(first: string, second: string): boolean {
  const clean = (text: string): string => text.replace(/\r\n?/g, "\n").trim();
  return clean(first) === clean(second);
}

/**
 * Cuando lo guardado de un idioma cambia, lo trae a los campos que seguían
 * mostrando lo anterior: uno con el texto viejo parecería editado. Los que la
 * persona cambió se quedan como están, con su foco. Devuelve el ref de donde
 * están los campos.
 */
export function useSyncedFields(
  code: string,
  stored: FaqText | undefined,
): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const question = stored?.question ?? "";
  const answer = stored?.answer ?? "";
  const painted = useRef<FaqText>({ question, answer });
  useEffect(() => {
    const next = { question, answer };
    for (const part of PARTS) {
      const field = containerRef.current?.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >(`[name="${faqField(part, code)}"]`);
      if (field && isSameText(field.value, painted.current[part])) {
        field.value = next[part];
      }
    }
    painted.current = next;
  }, [code, question, answer]);
  return containerRef;
}
