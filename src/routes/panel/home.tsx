import type { ReactElement } from "react";

import { PanelScreen } from "~/components/panel-screen";
import { PanelSignOut } from "~/components/panel-sign-out";
import { useTranslate } from "~/lib/i18n/translations-context";
import { panelMemberContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/home";

const DETAILS_STYLES =
  "mt-6 text-[16px] leading-[1.5] [overflow-wrap:anywhere]";

type PanelHome =
  | { readonly view: "admin"; readonly displayName: string }
  | { readonly view: "staff" };

export function loader({ context }: Route.LoaderArgs): PanelHome {
  const member = context.get(panelMemberContext);
  if (member.role === "staff") return { view: "staff" };
  return { view: "admin", displayName: member.fullName ?? member.email };
}

/** Provisional: la cáscara y el resumen los construyen sus tickets. El staff
 * solo tiene esta pantalla (decisión 11 del PRD de W10a). */
export function HomeScreen(home: PanelHome): ReactElement {
  const translate = useTranslate();
  const isStaff = home.view === "staff";
  return (
    <PanelScreen
      title={translate(isStaff ? "panel.staff.title" : "panel.home.title")}
    >
      <p className={DETAILS_STYLES}>
        {isStaff
          ? translate("panel.staff.details")
          : translate("panel.home.signedInAs", { name: home.displayName })}
      </p>
      {isStaff ? null : (
        <p className="mt-2 text-[14px] leading-[1.5] text-ink-subtle">
          {translate("panel.home.pending")}
        </p>
      )}
      <PanelSignOut />
    </PanelScreen>
  );
}

export default function Home({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <HomeScreen {...loaderData} />;
}
