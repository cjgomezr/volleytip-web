import { useLocation } from "react-router";

import { getPageAtPath, type CurrentPage } from "./pages";

/** La página del sitio que se está pintando, o `undefined` si la dirección
 * no es de ninguna (un 404, las páginas de `/dev/`). */
export function useCurrentPage(): CurrentPage | undefined {
  return getPageAtPath(useLocation().pathname);
}
