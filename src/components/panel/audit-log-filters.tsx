import type { ReactElement } from "react";
import { Form, Link, useLocation } from "react-router";

import { AUDIT_PARAMS } from "~/lib/admin/audit-filters";
import type { AuditListView } from "~/lib/admin/audit-log";
import { useTranslate } from "~/lib/i18n/translations-context";

import { Button, getButtonLinkClassName } from "../button";
import { SelectField } from "../select-field";
import { TextField } from "../text-field";

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

/** Los filtros de la bitácora: un formulario GET, así que quedan en la
 * dirección y sirven sin JavaScript. */
export function AuditLogFilters({
  filters,
  options,
  clearHref,
  canClear,
}: AuditLogFiltersProps): ReactElement {
  const translate = useTranslate();
  const { search } = useLocation();
  return (
    // `key`: al cambiar la dirección los campos vuelven a leer sus valores.
    <Form
      key={search}
      method="get"
      aria-label={translate("panel.auditLog.filters.label")}
      className="mt-5 grid gap-4 rounded-card bg-surface-light p-4 sm:grid-cols-2 md:p-5 xl:grid-cols-4"
    >
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
