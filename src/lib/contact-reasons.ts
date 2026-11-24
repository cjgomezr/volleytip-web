import { CONTACT_REASON_BRANDS } from "./contact-link";
import type { Language } from "./i18n/languages";
import type { MessageReason } from "./messages.server";

export type ContactReasonId = "order" | "camps" | "brands" | "tip" | "other";

/** El campo que un motivo agrega al formulario, con el nombre con que viaja. */
export type ContactExtraField = "orderNumber" | "brand";

export interface ContactReason {
  readonly id: ContactReasonId;
  /** El motivo con que se guarda el mensaje en la base. */
  readonly storedReason: MessageReason;
  /** El valor del parámetro `motivo` de la dirección, por idioma. */
  readonly slugs: Readonly<Record<Language, string>>;
  readonly extraField?: ContactExtraField;
}

// El orden es el de los botones de la página. "Camps y VBall Tour" se guarda
// como `camps`: el equipo de camps atiende los dos.
export const CONTACT_REASONS: readonly ContactReason[] = [
  {
    id: "order",
    storedReason: "order",
    slugs: { es: "pedido", en: "order" },
    extraField: "orderNumber",
  },
  { id: "camps", storedReason: "camps", slugs: { es: "camps", en: "camps" } },
  {
    id: "brands",
    storedReason: "brands",
    // El valor en español lo comparte el botón de Nosotros.
    slugs: { es: CONTACT_REASON_BRANDS, en: "brands" },
    extraField: "brand",
  },
  {
    id: "tip",
    storedReason: "suggest_tip",
    slugs: { es: "tip", en: "tip" },
  },
  { id: "other", storedReason: "other", slugs: { es: "otro", en: "other" } },
];

const FALLBACK_REASON: ContactReasonId = "other";

export function findContactReason(id: ContactReasonId): ContactReason {
  const reason = CONTACT_REASONS.find((candidate) => candidate.id === id);
  if (reason === undefined) {
    throw new Error(`El motivo de contacto "${id}" no existe.`);
  }
  return reason;
}

export function getContactReasonSlug(
  id: ContactReasonId,
  language: Language,
): string {
  return findContactReason(id).slugs[language];
}

/** El motivo que nombra un valor de la dirección, en cualquiera de los dos
 * idiomas. Uno desconocido o ausente es "Otro". */
export function resolveContactReason(
  value: string | null | undefined,
): ContactReasonId {
  const reason = CONTACT_REASONS.find(({ slugs }) =>
    Object.values(slugs).includes(value ?? ""),
  );
  return reason?.id ?? FALLBACK_REASON;
}
