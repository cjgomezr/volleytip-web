import type { ReactElement } from "react";

import { SiteTextsScreen } from "~/components/panel/site-texts-screen";
import type { SiteTextsView } from "~/lib/admin/site-texts";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { readSiteTextsEditor } from "~/lib/panel/site-texts-editor.server";

import type { Route } from "./+types/site-texts";

export function loader({ context }: Route.LoaderArgs): Promise<SiteTextsView> {
  return readSiteTextsEditor(context.get(panelSessionContext).client);
}

export default function SiteTexts({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <SiteTextsScreen {...loaderData} />;
}
