import type { TipCardData, TipsListing } from "./tips-listing.server";
import { LOAD_MORE_PARAMETER } from "./tips-query";

// Lo que "Cargar más tips" va juntando en el navegador, y cómo se distingue su
// pedido del de una navegación.

export interface LoadMoreFailure {
  readonly hasFailed: true;
}

/** La dirección con que se piden más tips: la del enlace, marcada. */
export function toLoadMoreHref(href: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${LOAD_MORE_PARAMETER}=1`;
}

export function isLoadMoreRequest(request: Request): boolean {
  return new URL(request.url).searchParams.has(LOAD_MORE_PARAMETER);
}

/**
 * Lee del servidor. Si es "Cargar más" y falla (sin red o con la base caída),
 * lo devuelve como resultado: un error lanzado pintaría la página de error y
 * se perdería lo que ya se veía. Una redirección sigue su camino, y una
 * navegación que falla también.
 */
export async function readReportingFailure<Data>(
  request: Request,
  read: () => Promise<Data>,
): Promise<Data | LoadMoreFailure> {
  if (!isLoadMoreRequest(request)) return read();
  try {
    return await read();
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("No se pudieron cargar más tips.", error);
    return { hasFailed: true };
  }
}

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
