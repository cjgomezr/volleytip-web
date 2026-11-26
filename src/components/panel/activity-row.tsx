import type { ReactElement } from "react";
import { Link } from "react-router";

import { useTranslate } from "~/lib/i18n/translations-context";

import { TRANSITION_STYLES } from "../pressable-styles";

const ITEM_STYLES = "border-b border-line-light last:border-b-0";
const ROW_STYLES =
  "flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4";
// El anillo de foco va por dentro: la lista recorta lo que se sale de ella.
const LINK_STYLES = `group text-brand-night no-underline hovered:underline pressed:bg-brand-indigo pressed:text-brand-mist focused:outline-brand-night focused:-outline-offset-3 ${TRANSITION_STYLES}`;
const DETAIL_STYLES =
  "text-[14px] leading-[1.4] text-ink-subtle group-pressed:text-brand-mist";

export interface ActivityRowEntry {
  readonly action: string;
  /** Nulo cuando la acción no la hizo una persona. */
  readonly actorName: string | null;
  /** La fecha para `<time>`. */
  readonly dateTime: string;
  readonly date: string;
  /** Sobre qué tipo de cosa, si la lista lo muestra. */
  readonly entity?: string;
}

function ActivityBody({
  entry,
}: {
  readonly entry: ActivityRowEntry;
}): ReactElement {
  const translate = useTranslate();
  return (
    <>
      <p className="m-0 min-w-0 [overflow-wrap:anywhere]">
        <span className="block text-[15px] leading-[1.4] font-bold">
          {entry.action}
        </span>
        <span className={`block ${DETAIL_STYLES}`}>
          {entry.actorName ?? translate("panel.overview.activity.system")}
        </span>
        {entry.entity === undefined ? null : (
          <span className={`block ${DETAIL_STYLES}`}>
            {translate("panel.activity.entity", { entity: entry.entity })}
          </span>
        )}
      </p>
      <time
        dateTime={entry.dateTime}
        className="shrink-0 text-[13px] leading-[1.4] text-ink-subtle group-pressed:text-brand-mist"
      >
        {entry.date}
      </time>
    </>
  );
}

/** Una entrada de la bitácora en una lista. Con `href`, la fila entera la
 * abre. */
export function ActivityRow({
  entry,
  href,
}: {
  readonly entry: ActivityRowEntry;
  readonly href?: string;
}): ReactElement {
  return (
    <li className={ITEM_STYLES}>
      {href === undefined ? (
        <div className={ROW_STYLES}>
          <ActivityBody entry={entry} />
        </div>
      ) : (
        <Link to={href} className={`${ROW_STYLES} ${LINK_STYLES}`}>
          <ActivityBody entry={entry} />
        </Link>
      )}
    </li>
  );
}
