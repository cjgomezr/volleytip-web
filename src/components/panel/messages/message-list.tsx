import type { ReactElement } from "react";
import { Link } from "react-router";

import type { InboxRowView } from "~/lib/admin/messages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

import { TRANSITION_STYLES } from "../../pressable-styles";
import { ReasonBadge, StatusBadge } from "./message-badges";

const COLUMNS = [
  { key: "panel.messages.column.name", width: "lg:w-[46%]" },
  { key: "panel.messages.column.reason", width: "lg:w-[24%]" },
  { key: "panel.messages.column.date", width: "lg:w-[16%]" },
  { key: "panel.messages.column.status", width: "lg:w-[14%]" },
] as const satisfies readonly { key: MessageKey; width: string }[];

// Desde 1024 px es una tabla. Debajo, cada mensaje es una fila apilada: con
// el menú lateral no hay ancho para cuatro columnas. Los roles van escritos
// porque cambiar el `display` le quita a una tabla su significado.
const ROW_STYLES =
  "relative hover:bg-line-light border-b border-line-light last:border-b-0 max-lg:min-h-11 max-lg:flex max-lg:flex-wrap max-lg:items-center max-lg:gap-x-3 max-lg:gap-y-1.5 max-lg:px-4 max-lg:py-3";
const CELL_STYLES = "min-w-0 text-left lg:px-4 lg:py-3 lg:align-top";
// El enlace cubre toda la fila: esa es la zona que se toca. En la tabla mide
// lo mismo que las insignias, para que la fila quede alineada.
const NAME_LINK_STYLES = `inline-flex max-w-full lg:min-h-[26px] items-center text-[16px] leading-[1.35] font-bold text-brand-night underline-offset-2 [overflow-wrap:anywhere] hovered:underline pressed:text-brand-indigo focused:outline-brand-night after:absolute after:inset-0 ${TRANSITION_STYLES}`;

function MessageRow({ row }: { readonly row: InboxRowView }): ReactElement {
  return (
    <tr role="row" data-message-row className={ROW_STYLES}>
      <td role="cell" className={`${CELL_STYLES} max-lg:w-full`}>
        <Link to={row.href} className={NAME_LINK_STYLES}>
          {row.name}
        </Link>
        <span className="mt-1 line-clamp-2 text-[14px] leading-[1.45] text-ink-subtle [overflow-wrap:anywhere]">
          {row.excerpt}
        </span>
      </td>
      <td role="cell" className={CELL_STYLES}>
        <ReasonBadge reason={row.reason} />
      </td>
      <td
        role="cell"
        className={`${CELL_STYLES} text-[13px] leading-[1.45] text-ink-subtle max-lg:order-last lg:leading-[26px]`}
      >
        <time dateTime={row.dateTime}>{row.date}</time>
      </td>
      <td role="cell" className={`${CELL_STYLES} max-lg:ml-auto`}>
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );
}

export function MessageList({
  rows,
}: {
  readonly rows: readonly InboxRowView[];
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className="mt-4 overflow-hidden rounded-card bg-surface-light">
      <table
        role="table"
        aria-label={translate("panel.module.messages")}
        className="w-full border-collapse max-lg:block lg:table-fixed"
      >
        <thead role="rowgroup" className="max-lg:sr-only">
          <tr role="row" className="border-b border-line-light">
            {COLUMNS.map(({ key, width }) => (
              <th
                key={key}
                role="columnheader"
                scope="col"
                className={`px-4 py-3 text-left text-[12px] leading-[1.4] font-bold tracking-[0.08em] text-ink-subtle uppercase ${width}`}
              >
                {translate(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="max-lg:block">
          {rows.map((row) => (
            <MessageRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
