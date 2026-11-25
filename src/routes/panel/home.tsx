import type { ReactElement } from "react";

import { PanelHeading } from "~/components/panel/panel-heading";
import { PanelScreen } from "~/components/panel-screen";
import { PanelSignOut } from "~/components/panel-sign-out";
import type { PanelRole } from "~/lib/admin/modules";
import { useTranslate } from "~/lib/i18n/translations-context";
import { panelMemberContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/home";

interface PanelHome {
  readonly view: PanelRole;
}

export function loader({ context }: Route.LoaderArgs): PanelHome {
  return { view: context.get(panelMemberContext).role };
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

/** Provisional para el admin: el resumen lo construye su ticket. */
function OverviewScreen(): ReactElement {
  const translate = useTranslate();
  return (
    <>
      <PanelHeading title={translate("panel.module.overview")} />
      <p className="mt-5 text-[16px] leading-[1.5] text-ink-subtle">
        {translate("panel.home.pending")}
      </p>
    </>
  );
}

export function HomeScreen({ view }: PanelHome): ReactElement {
  return view === "staff" ? <StaffScreen /> : <OverviewScreen />;
}

export default function Home({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <HomeScreen {...loaderData} />;
}
