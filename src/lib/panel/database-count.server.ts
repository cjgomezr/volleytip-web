/** Para `select(..., COUNT_ONLY)`: cuenta en la base sin traer filas. */
export const COUNT_ONLY = { count: "exact", head: true } as const;

interface CountResult {
  readonly count: number | null;
  readonly error: object | null;
  readonly status: number;
}

/** El número de una consulta de conteo. La respuesta de `head: true` no tiene
 * cuerpo, así que de un error solo se sabe el estado. */
export async function takeCount(
  query: PromiseLike<CountResult>,
): Promise<number> {
  const { count, error, status } = await query;
  if (error !== null || count === null) {
    throw new Error(`La base no devolvió el conteo (estado ${status})`, {
      cause: error,
    });
  }
  return count;
}
