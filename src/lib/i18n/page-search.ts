import { translateTipsSearch } from "../tips-query";
import type { Language } from "./languages";
import type { PageId } from "./pages";

interface PageSearch {
  readonly page: PageId;
  /** La cadena de búsqueda de la dirección, con su `?`, o "". */
  readonly search: string;
  readonly from: Language;
  readonly to: Language;
}

/** La búsqueda de la dirección de una página, como se escribe en otro idioma.
 * Casi siempre es la misma: solo el listado de tips traduce sus parámetros. */
export function translatePageSearch({
  page,
  search,
  from,
  to,
}: PageSearch): string {
  return page === "tips" ? translateTipsSearch(search, from, to) : search;
}
