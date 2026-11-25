import type { ReactElement } from "react";
import { Link } from "react-router";

import type { NavigationEntry } from "~/lib/admin/navigation";
import { useTranslate } from "~/lib/i18n/translations-context";

import { PanelSignOut } from "../panel-sign-out";
import { TRANSITION_STYLES } from "../pressable-styles";
import { PanelHeading } from "./panel-heading";
import { usePanelNavigation } from "./panel-navigation-context";
import { PendingBadge } from "./pending-badge";

const ROW_STYLES = `flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-[16px] font-bold text-brand-night no-underline hovered:underline pressed:bg-line-light focused:-outline-offset-4 focused:outline-brand-night ${TRANSITION_STYLES}`;

function MoreRow({ entry }: { readonly entry: NavigationEntry }): ReactElement {
  const translate = useTranslate();
  const currentStyles = entry.isCurrent
    ? "border-l-[3px] border-brand-red"
    : "";
  return (
    <li className="border-b border-line-light last:border-b-0">
      <Link
        to={entry.href}
        aria-current={entry.isCurrent ? "page" : undefined}
        className={`${ROW_STYLES} ${currentStyles}`}
      >
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {translate(entry.labelKey)}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-ink-subtle">
          {entry.pendingCount === undefined ? null : (
            <PendingBadge count={entry.pendingCount} />
          )}
          <span aria-hidden="true">›</span>
        </span>
      </Link>
    </li>
  );
}

/** La pantalla "Más": los módulos que no están en la barra inferior y "Cerrar
 * sesión". Va dentro de `PanelShell`. */
export function PanelMore(): ReactElement {
  const translate = useTranslate();
  const { more } = usePanelNavigation();
  return (
    <section data-panel-region="more" className="max-w-[640px]">
      <PanelHeading title={translate("panel.nav.more")} />
      {more.length === 0 ? null : (
        <ul
          data-panel-region="more-list"
          className="mt-5 mb-0 list-none overflow-hidden rounded-card bg-surface-light p-0"
        >
          {more.map((entry) => (
            <MoreRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-col">
        <PanelSignOut />
      </div>
    </section>
  );
}
