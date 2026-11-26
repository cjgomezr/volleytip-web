import type { ReactElement } from "react";

import { AuditEntryScreen } from "~/components/panel/audit-entry-screen";
import {
  buildAuditEntryView,
  type AuditEntryView,
} from "~/lib/admin/audit-log";
import { keepAuditSearch } from "~/lib/admin/audit-filters";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { readAuditEntry } from "~/lib/panel/audit-log-reader.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { buildPanelNotFound } from "~/lib/panel/panel-not-found.server";

import type { Route } from "./+types/audit-log-entry";

export async function loader({
  request,
  context,
  params,
}: Route.LoaderArgs): Promise<AuditEntryView> {
  const entry = await readAuditEntry(
    context.get(panelSessionContext).client,
    params.id ?? "",
  );
  if (entry === null) throw await buildPanelNotFound(request);
  const language = getRequestLanguage(request);
  // La búsqueda trae los filtros de la lista: solo se usa para volver a ella.
  const search = keepAuditSearch(new URL(request.url).searchParams);
  return buildAuditEntryView(entry, {
    language,
    backHref: `${getPanelPath("adminAuditLog", language)}${search}`,
  });
}

export function AuditEntryPage(view: AuditEntryView): ReactElement {
  return <AuditEntryScreen {...view} />;
}

export default function AuditEntry({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <AuditEntryPage {...loaderData} />;
}
