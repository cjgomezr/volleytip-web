/**
 * Campo trampa (FR-135, capa 1). El formulario lleva un campo que una
 * persona no ve ni llena. Un bot que rellena todo lo que encuentra sí lo
 * llena, y ese envío se descarta.
 */

/** Nombre de campo que parece real: uno que se llamara "trampa" no engaña. */
export const HONEYPOT_FIELD = "website";

/**
 * Dice si el campo trampa llegó con algo. Vacío o ausente es lo normal.
 * Cualquier contenido cuenta, también unos espacios o un archivo: una
 * persona no puede haber escrito ahí.
 */
export function isHoneypotFilled(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD);
  return value !== null && value !== "";
}
