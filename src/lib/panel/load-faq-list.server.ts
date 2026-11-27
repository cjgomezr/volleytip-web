import type { LoaderFunctionArgs } from "react-router";

import type { FaqListView } from "../admin/faqs";
import { getRequestLanguage } from "../i18n/languages";
import { readFaqList } from "./faqs-reader.server";
import { panelSessionContext } from "./panel-middleware.server";

/** El loader de la lista y de las rutas de sus botones, que sin JavaScript la
 * vuelven a pintar. */
export function loadFaqList({
  request,
  context,
}: LoaderFunctionArgs): Promise<FaqListView> {
  return readFaqList(context.get(panelSessionContext).client, {
    language: getRequestLanguage(request),
    url: new URL(request.url),
  });
}
