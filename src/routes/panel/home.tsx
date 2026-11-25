import type { ReactElement } from "react";

import { OverviewScreen } from "~/components/panel/overview-screen";
import { PanelScreen } from "~/components/panel-screen";
import { PanelSignOut } from "~/components/panel-sign-out";
import { ADMIN_MODULES } from "~/lib/admin/modules";
import { buildOverviewView, type OverviewView } from "~/lib/admin/overview";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { readOverview } from "~/lib/panel/overview.server";
import {
  panelMemberContext,
  panelSessionContext,
} from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/home";

type PanelHome =
  | { readonly view: "staff" }
  | {
      readonly view: "admin";
      /** El nombre del perfil o, si no tiene, el correo. */
      readonly greetingName: string;
      readonly overview: OverviewView;
    };

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PanelHome> {
  const member = context.get(panelMemberContext);
  // El staff no ve ningún dato del panel: ni se consultan.
  if (member.role === "staff") return { view: "staff" };
  const data = await readOverview(context.get(panelSessionContext).client, {
    modules: ADMIN_MODULES,
    now: new Date(),
  });
  return {
    view: "admin",
    greetingName: member.fullName ?? member.email,
    overview: buildOverviewView(data, {
      modules: ADMIN_MODULES,
      language: getRequestLanguage(request),
    }),
  };
}

/** El staff solo tiene esta pantalla, sin la cáscara (decisión 11 del PRD de
 * W10a). */
function StaffScreen(): ReactElement {
  const translate = useTranslate();
  return (
    <PanelScreen title={translate("panel.staff.title")}>
      <p className="mt-6 text-[16px] leading-[1.5] [overflow-wrap:anywhere]">
        {translate("panel.staff.details")}
      </p>
      <div className="mt-8 flex flex-col items-start">
        <PanelSignOut />
      </div>
    </PanelScreen>
  );
}

export function HomeScreen(home: PanelHome): ReactElement {
  if (home.view === "staff") return <StaffScreen />;
  return (
    <OverviewScreen greetingName={home.greetingName} overview={home.overview} />
  );
}

export default function Home({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <HomeScreen {...loaderData} />;
}
