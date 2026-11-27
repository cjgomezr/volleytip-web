import { useEffect, useRef, type ReactElement, type RefObject } from "react";
import { Form, Link, useLocation } from "react-router";

import { AUDIT_PARAMS } from "~/lib/admin/audit-filters";
import type { AuditListView } from "~/lib/admin/audit-log";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useOfflineGuard } from "~/lib/panel/use-offline-guard";

import { Button, getButtonLinkClassName } from "../button";
import { SelectField } from "../select-field";
import { TextField } from "../text-field";
import { UnsentNotice } from "./unsent-notice";

type AuditLogFiltersProps = Pick<
  AuditListView,
  "filters" | "options" | "clearHref"
> & {
  /** Con filtros puestos y entradas a la vista: sin ellas, el aviso ya
   * ofrece quitarlos. */
  readonly canClear: boolean;
};

/** El enlace que vuelve a la lista sin filtros. */
export function ClearFiltersLink({
  href,
}: {
  readonly href: string;
}): ReactElement {
  const translate = useTranslate();
  return (
    <Link to={href} className={getButtonLinkClassName("secondary", "light")}>
      {translate("panel.auditLog.filters.clear")}
    </Link>
  );
}

// Al navegar sin recargar, los campos conservan lo que tenían: se ponen al día
// con la dirección sin volver a montarlos, para no perder el foco.
function useFieldsFromAddress(
  filters: AuditListView["filters"],
): RefObject<HTMLFormElement | null> {
  const form = useRef<HTMLFormElement>(null);
  const { search } = useLocation();
  useEffect(() => {
    for (const key of ["actorId", "action", "fromDay", "toDay"] as const) {
      const field = form.current?.elements.namedItem(AUDIT_PARAMS[key]);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement
      ) {
        field.value = filters[key] ?? "";
      }
    }
  }, [filters, search]);
  return form;
}

/** Los filtros de la bitácora: un formulario GET, así que quedan en la
 * dirección y sirven sin JavaScript. */
export function AuditLogFilters({
  filters,
  options,
  clearHref,
  canClear,
}: AuditLogFiltersProps): ReactElement {
  const offline = useOfflineGuard();
  const translate = useTranslate();
  const form = useFieldsFromAddress(filters);
  return (
    <Form
      onSubmit={offline.onSubmit}
      ref={form}
      method="get"
      aria-label={translate("panel.auditLog.filters.label")}
      className="mt-5 grid gap-4 rounded-card bg-surface-light p-4 sm:grid-cols-2 md:p-5 xl:grid-cols-4"
    >
      {offline.isBlocked ? (
        <div className="col-span-full mb-4">
          <UnsentNotice />
        </div>
      ) : null}
      <SelectField
        zone="light"
        label={translate("panel.auditLog.filters.person")}
        name={AUDIT_PARAMS.actorId}
        defaultValue={filters.actorId ?? ""}
        options={[
          { value: "", label: translate("panel.auditLog.filters.allPeople") },
          ...options.actors.map(({ id, name }) => ({ value: id, label: name })),
        ]}
      />
      <SelectField
        zone="light"
        label={translate("panel.auditLog.filters.action")}
        name={AUDIT_PARAMS.action}
        defaultValue={filters.action ?? ""}
        options={[
          { value: "", label: translate("panel.auditLog.filters.allActions") },
          ...options.actions.map((action) => ({
            value: action,
            label: action,
          })),
        ]}
      />
      <TextField
        zone="light"
        type="date"
        label={translate("panel.auditLog.filters.from")}
        name={AUDIT_PARAMS.fromDay}
        defaultValue={filters.fromDay ?? ""}
      />
      <TextField
        zone="light"
        type="date"
        label={translate("panel.auditLog.filters.to")}
        name={AUDIT_PARAMS.toDay}
        defaultValue={filters.toDay ?? ""}
      />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-4">
        <Button type="submit" zone="light">
          {translate("panel.auditLog.filters.apply")}
        </Button>
        {canClear ? <ClearFiltersLink href={clearHref} /> : null}
      </div>
    </Form>
  );
}
