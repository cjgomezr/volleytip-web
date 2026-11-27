import type { ReactElement } from "react";

import { FaqListScreen } from "~/components/panel/faqs/faq-list-screen";
import type { FaqListView } from "~/lib/admin/faqs";
import { loadFaqList } from "~/lib/panel/load-faq-list.server";

import type { Route } from "./+types/faqs";

// El fallo de un botón de la lista llega aquí: el envío es de esta ruta.
export function loader(args: Route.LoaderArgs): Promise<FaqListView> {
  return loadFaqList(args);
}

export default function Faqs({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <FaqListScreen {...loaderData} />;
}
