const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dice si un texto puede ser el id de una fila. Con otra cosa la base rechaza
 * la consulta en vez de no encontrar nada. */
export function isUuid(text: string): boolean {
  return UUID.test(text);
}
