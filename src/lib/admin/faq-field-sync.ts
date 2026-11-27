import { normalizeFaqPart, type FaqPart } from "./faqs";

/** Un campo del editor y su campo oculto, el que le dice al servidor qué
 * texto vio la persona. */
export interface FaqFieldPair {
  readonly visible: string;
  readonly base: string;
}

interface FaqFieldState extends FaqFieldPair {
  /** Lo que la base tiene ahora. */
  readonly stored: string;
  /** Lo que el último envío de esta persona llevaba en el campo. */
  readonly sent: string | undefined;
}

/**
 * Cómo quedan un campo y su base cuando lo guardado cambia.
 *
 * La base solo avanza si la persona ya vio lo guardado o si es lo que ella
 * misma envió. Si escribió encima de un texto que otra persona cambió, la
 * base se queda atrás: así el servidor nota el choque en el siguiente guardado
 * en vez de pisar lo ajeno.
 */
export function syncFaqField(
  part: FaqPart,
  { visible, base, stored, sent }: FaqFieldState,
): FaqFieldPair {
  const clean = (text: string): string => normalizeFaqPart(part, text);
  const isUntouched = clean(visible) === clean(base);
  if (isUntouched) {
    const isAlreadyShown = clean(visible) === clean(stored);
    return { visible: isAlreadyShown ? visible : stored, base: stored };
  }
  const isOwnSave = sent !== undefined && clean(sent) === clean(stored);
  return { visible, base: isOwnSave ? stored : base };
}
