/**
 * Supabase CLI aplica cada archivo de migración dentro de una sola
 * transacción: si una sentencia falla, no queda nada del archivo. Una
 * sentencia de control de transacción escrita en el archivo cierra esa
 * transacción antes de tiempo, y lo que venía antes queda aplicado aunque lo
 * de después falle.
 *
 * Solo coincide la sentencia suelta. El `begin` de un bloque plpgsql va
 * seguido de un salto de línea, no de un punto y coma, y su `end;` no es una
 * de estas palabras.
 *
 * Es una revisión por texto, no un analizador de SQL: no entiende comentarios
 * de bloque ni literales de cadena, y no detecta sentencias que no pueden
 * correr dentro de una transacción (`create index concurrently`, `vacuum`).
 * Esas fallan solas al aplicarse, sin dejar nada a medias.
 */
const TRANSACTION_CONTROL =
  /^\s*(begin|start\s+transaction|commit|rollback)(\s+(transaction|work))?\s*;/im;

function removeLineComments(sql: string): string {
  return sql.replaceAll(/--.*$/gm, "");
}

/** Dice si el SQL de una migración abre o cierra transacciones por su cuenta. */
export function hasTransactionControl(sql: string): boolean {
  return TRANSACTION_CONTROL.test(removeLineComments(sql));
}
