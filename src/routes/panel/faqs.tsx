import type { ReactElement } from "react";

import { FaqListScreen } from "~/components/panel/faqs/faq-list-screen";
import type { FaqListView } from "~/lib/admin/faqs";
import { loadFaqList } from "~/lib/panel/load-faq-list.server";

import type { Route } from "./+types/faqs";

export function loader(args: Route.LoaderArgs): Promise<FaqListView> {
  return loadFaqList(args);
}

export default function Faqs({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <FaqListScreen {...loaderData} />;
}
