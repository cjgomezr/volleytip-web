import type { TipCardData, TipsListing } from "./tips-listing.server";

// Lo que "Cargar más tips" va juntando en el navegador.

export interface AppendedTips {
  /** Los de las páginas siguientes a la que llegó con la dirección. */
  readonly extra: readonly TipCardData[];
  /** La última página que ya está a la vista. */
  readonly page: number;
  readonly hasNextPage: boolean;
  /** Los que trajo la última carga. */
  readonly added: readonly TipCardData[];
}

/**
 * Suma la página recibida a lo cargado. Cualquier página que no sea la
 * siguiente se ignora. Si entre las dos lecturas se publicó un tip, el último
 * ya visto vuelve a llegar: no se repite.
 */
export function appendTipsPage(
  appended: AppendedTips,
  firstTips: readonly TipCardData[],
  { query, tips, hasNextPage }: TipsListing,
): AppendedTips {
  if (query.page !== appended.page + 1) return appended;
  const known = new Set([...firstTips, ...appended.extra].map(({ id }) => id));
  const added = tips.filter(({ id }) => !known.has(id));
  return {
    extra: [...appended.extra, ...added],
    page: query.page,
    hasNextPage,
    added,
  };
}
