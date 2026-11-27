import { useEffect, useRef, type ReactElement } from "react";
import { Form, Link } from "react-router";

import {
  REASON_LABEL_KEYS,
  REASON_PARAM,
  SEARCH_PARAM,
  STATUS_LABEL_KEYS,
  STATUS_PARAM,
  type InboxQuery,
} from "~/lib/admin/messages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useOfflineGuard } from "~/lib/panel/use-offline-guard";

import { Button } from "../../button";
import { SelectField } from "../../select-field";
import { TextField } from "../../text-field";
import { TEXT_LINK_STYLES } from "./message-styles";
import { UnsentNotice } from "../unsent-notice";

// Los campos no son controlados. Cuando la dirección cambia sin que la
// persona los toque ("Quitar filtros", atrás), se ponen al día sin volver a
// montarlos: así el foco no se pierde al filtrar.
function useFieldsFromAddress({
  search,
  reason,
  status,
}: InboxQuery): React.RefObject<HTMLDivElement | null> {
  const fields = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const values = {
      [SEARCH_PARAM]: search,
      [REASON_PARAM]: reason ?? "",
      [STATUS_PARAM]: status ?? "",
    };
    for (const [name, value] of Object.entries(values)) {
      const field = fields.current?.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`[name="${name}"]`);
      if (field) field.value = value;
    }
  }, [search, reason, status]);
  return fields;
}

interface InboxFiltersProps {
  readonly query: InboxQuery;
  /** La dirección de la bandeja sin filtros. */
  readonly inboxPath: string;
  /** Si ofrece quitar los filtros aquí. */
  readonly canClear: boolean;
}

/** Los filtros de la bandeja. Es un formulario GET: quedan en la dirección y
 * funcionan sin JavaScript. */
export function InboxFilters({
  query,
  inboxPath,
  canClear,
}: InboxFiltersProps): ReactElement {
  const offline = useOfflineGuard();
  const translate = useTranslate();
  const fields = useFieldsFromAddress(query);

  function buildOptions(
    allKey: MessageKey,
    labelKeys: Readonly<Record<string, MessageKey>>,
  ): { value: string; label: string }[] {
    return [
      { value: "", label: translate(allKey) },
      ...Object.entries(labelKeys).map(([value, key]) => ({
        value,
        label: translate(key),
      })),
    ];
  }

  return (
    <Form
      onSubmit={offline.onSubmit}
      method="get"
      action={inboxPath}
      role="search"
      aria-label={translate("panel.messages.filters.label")}
      className="mt-5 rounded-card bg-surface-light p-4 md:p-5"
    >
      {offline.isBlocked ? (
        <div className="col-span-full mb-4">
          <UnsentNotice />
        </div>
      ) : null}
      <div
        ref={fields}
        className="grid gap-4 lg:grid-cols-[2fr_1.4fr_1.2fr_auto] lg:items-end"
      >
        <TextField
          zone="light"
          type="search"
          name={SEARCH_PARAM}
          label={translate("panel.messages.filters.search")}
          defaultValue={query.search}
        />
        <SelectField
          zone="light"
          name={REASON_PARAM}
          label={translate("panel.messages.filters.reason")}
          options={buildOptions(
            "panel.messages.filters.allReasons",
            REASON_LABEL_KEYS,
          )}
          defaultValue={query.reason ?? ""}
        />
        <SelectField
          zone="light"
          name={STATUS_PARAM}
          label={translate("panel.messages.filters.status")}
          options={buildOptions(
            "panel.messages.filters.allStatuses",
            STATUS_LABEL_KEYS,
          )}
          defaultValue={query.status ?? ""}
        />
        {/* Desde 1024 px va en la misma fila, a la altura de los campos. */}
        <div className="flex flex-col items-start lg:pb-px">
          <Button type="submit" variant="secondary" zone="light">
            {translate("panel.messages.filters.submit")}
          </Button>
        </div>
      </div>
      {canClear ? (
        <Link to={inboxPath} className={`mt-2 ${TEXT_LINK_STYLES}`}>
          {translate("panel.messages.filters.clear")}
        </Link>
      ) : null}
    </Form>
  );
}
