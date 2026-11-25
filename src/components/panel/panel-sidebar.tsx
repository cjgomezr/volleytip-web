import type { ReactElement } from "react";
import { Link } from "react-router";

import type { NavigationEntry } from "~/lib/admin/navigation";
import { useTranslate } from "~/lib/i18n/translations-context";

import { PanelSignOut } from "../panel-sign-out";
import { TRANSITION_STYLES } from "../pressable-styles";
import { PanelBrand } from "./panel-brand";
import { PanelLanguageSwitcher } from "./panel-language-switcher";
import { usePanelNavigation } from "./panel-navigation-context";
import { PanelUser, type PanelUserData } from "./panel-user";
import { PendingBadge } from "./pending-badge";

const LINK_STYLES = `flex min-h-11 items-center justify-between gap-2 rounded-control border-l-[3px] px-3 py-2 text-[14px] leading-[1.3] font-bold no-underline hovered:text-brand-lime pressed:text-brand-lime ${TRANSITION_STYLES}`;
const CURRENT_LINK_STYLES = "border-brand-red bg-brand-indigo";
const OTHER_LINK_STYLES = "border-transparent";

function SidebarLink({
  entry,
}: {
  readonly entry: NavigationEntry;
}): ReactElement {
  const translate = useTranslate();
  const stateStyles = entry.isCurrent ? CURRENT_LINK_STYLES : OTHER_LINK_STYLES;
  return (
    <li>
      <Link
        to={entry.href}
        aria-current={entry.isCurrent ? "page" : undefined}
        className={`${LINK_STYLES} ${stateStyles}`}
      >
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {translate(entry.labelKey)}
        </span>
        {entry.pendingCount === undefined ? null : (
          <PendingBadge count={entry.pendingCount} className="min-w-9" />
        )}
      </Link>
    </li>
  );
}

/** El menú lateral del computador, desde 768 px. */
export function PanelSidebar({
  member,
  languageAction,
}: {
  readonly member: PanelUserData;
  readonly languageAction: string;
}): ReactElement {
  const translate = useTranslate();
  const { sidebar } = usePanelNavigation();
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-6 overflow-y-auto bg-brand-night px-4 py-6 text-brand-mist md:flex">
      <div className="px-2">
        <PanelBrand />
      </div>
      <nav
        aria-label={translate("panel.nav.label")}
        data-panel-region="sidebar-nav"
      >
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {sidebar.map((entry) => (
            <SidebarLink key={entry.id} entry={entry} />
          ))}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col items-start gap-4 border-t border-brand-indigo px-2 pt-4">
        <PanelUser {...member} />
        <PanelLanguageSwitcher action={languageAction} />
        <PanelSignOut zone="dark" />
      </div>
    </aside>
  );
}
