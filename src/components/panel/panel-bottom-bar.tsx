import type { ReactElement } from "react";
import { Link } from "react-router";

import type { BottomBarEntry, NavigationEntry } from "~/lib/admin/navigation";
import { useTranslate } from "~/lib/i18n/translations-context";

import { TRANSITION_STYLES } from "../pressable-styles";
import { usePanelNavigation } from "./panel-navigation-context";
import { PendingBadge } from "./pending-badge";

const MORE_GLYPH = "⋯";

// Cada lugar mide al menos 56 px de alto; el ancho se reparte entre todos.
const LINK_STYLES = `relative flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 border-t-[3px] px-1 py-2 text-center text-[12px] leading-[1.2] font-bold no-underline hovered:text-brand-lime pressed:text-brand-lime ${TRANSITION_STYLES}`;
const CURRENT_LINK_STYLES = "border-brand-red text-brand-mist";
const OTHER_LINK_STYLES = "border-transparent text-ink-muted";

interface BarLinkProps {
  readonly href: string;
  readonly label: string;
  readonly glyph: string;
  /** `page` si lleva a la pantalla actual; `true` si la contiene. */
  readonly current: "page" | "true" | undefined;
  readonly pendingCount: number | undefined;
}

function BarLink({
  href,
  label,
  glyph,
  current,
  pendingCount,
}: BarLinkProps): ReactElement {
  const stateStyles = current ? CURRENT_LINK_STYLES : OTHER_LINK_STYLES;
  return (
    <li className="min-w-0 flex-1">
      <Link
        to={href}
        aria-current={current}
        className={`${LINK_STYLES} h-full focused:-outline-offset-4 ${stateStyles}`}
      >
        <span aria-hidden="true" className="text-[20px] leading-none">
          {glyph}
        </span>
        <span className="max-w-full [overflow-wrap:anywhere]">{label}</span>
        {pendingCount === undefined ? null : (
          <PendingBadge
            count={pendingCount}
            className="absolute top-1 left-1/2 ml-2"
          />
        )}
      </Link>
    </li>
  );
}

function sumPending(entries: readonly NavigationEntry[]): number | undefined {
  const total = entries.reduce(
    (sum, { pendingCount = 0 }) => sum + pendingCount,
    0,
  );
  return total || undefined;
}

function pickMoreState(
  isMorePage: boolean,
  hidden: readonly NavigationEntry[],
): BarLinkProps["current"] {
  if (isMorePage) return "page";
  return hidden.some(({ isCurrent }) => isCurrent) ? "true" : undefined;
}

/** La barra fija del celular: los módulos que caben y "Más". Es `sticky` y no
 * `fixed`: ocupa su lugar y no tapa el final del contenido. */
export function PanelBottomBar({
  morePath,
}: {
  readonly morePath: string;
}): ReactElement {
  const translate = useTranslate();
  const { bar, more, isMorePage } = usePanelNavigation();

  function renderModule(entry: BottomBarEntry): ReactElement {
    return (
      <BarLink
        key={entry.id}
        href={entry.href}
        label={translate(entry.labelKey)}
        glyph={entry.glyph}
        current={entry.isCurrent ? "page" : undefined}
        pendingCount={entry.pendingCount}
      />
    );
  }

  return (
    <nav
      aria-label={translate("panel.nav.bottomLabel")}
      data-panel-region="bottom-bar"
      className="sticky bottom-0 z-10 bg-brand-night pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="m-0 flex list-none items-stretch p-0">
        {bar.map(renderModule)}
        <BarLink
          href={morePath}
          label={translate("panel.nav.more")}
          glyph={MORE_GLYPH}
          current={pickMoreState(isMorePage, more)}
          pendingCount={sumPending(more)}
        />
      </ul>
    </nav>
  );
}
