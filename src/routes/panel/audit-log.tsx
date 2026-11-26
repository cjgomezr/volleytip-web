import type { ReactElement } from "react";

import { AuditLogScreen } from "~/components/panel/audit-log-screen";
import { buildAuditListView, type AuditListView } from "~/lib/admin/audit-log";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { buildPagePath } from "~/lib/i18n/page-path";
import { findPanelPage, getPanelPath } from "~/lib/i18n/panel-pages";
import { findLanguage } from "~/lib/i18n/pages";
import { readAuditPage } from "~/lib/panel/audit-log-reader.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";

import type { Route } from "./+types/audit-log";

// Solo `loader`: la bitácora se lee, nadie la edita ni la borra.
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<AuditListView> {
  const data = await readAuditPage(
    context.get(panelSessionContext).client,
    new URL(request.url).searchParams,
  );
  const language = getRequestLanguage(request);
  const entryPage = findPanelPage("adminAuditLogEntry");
  return buildAuditListView(data, {
    language,
    links: {
      listPath: getPanelPath("adminAuditLog", language),
      buildEntryHref: (id, search) =>
        `${buildPagePath(entryPage, findLanguage(language), { id })}${search}`,
    },
  });
}

export function AuditLogPage(view: AuditListView): ReactElement {
  return <AuditLogScreen {...view} />;
}

export default function AuditLog({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <AuditLogPage {...loaderData} />;
}
