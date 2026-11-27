import { isDeepStrictEqual } from "node:util";

import { normalizeFaqText, type FaqText } from "../admin/faqs";
import type { FaqSubmission } from "./faq-input.server";

type Texts = Readonly<Record<string, FaqText>>;

export interface TranslationChange {
  readonly written: Texts;
  readonly removed: readonly string[];
  /** Lo que había en los idiomas que se tocan: la base escribe solo si sigue
   * igual. */
  readonly expected: Texts;
}

/**
 * Lo que un envío cambia, idioma por idioma: solo lo que la persona editó
 * respecto a lo que vio. Así no se borra ni se pisa lo que otra escribió
 * mientras tanto. Devuelve `"stale"` si las dos cambiaron el mismo idioma.
 */
export function planFaqChange(
  stored: Texts,
  { texts, painted }: Pick<FaqSubmission, "texts" | "painted">,
): TranslationChange | "stale" {
  const written: Record<string, FaqText> = {};
  const removed: string[] = [];
  const expected: Record<string, FaqText> = {};
  // Los idiomas del formulario: los de uno desactivado se quedan como están.
  for (const [code, seen] of Object.entries(painted)) {
    const wanted = normalizeFaqText(texts[code]);
    if (isDeepStrictEqual(wanted, seen)) continue;
    const current = normalizeFaqText(stored[code]);
    if (isDeepStrictEqual(wanted, current)) continue;
    if (!isDeepStrictEqual(current, seen)) return "stale";
    const submitted = texts[code];
    if (submitted === undefined) removed.push(code);
    else written[code] = submitted;
    const previous = stored[code];
    if (previous !== undefined) expected[code] = previous;
  }
  return { written, removed, expected };
}
