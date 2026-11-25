import type { ReactElement } from "react";
import { data, redirect } from "react-router";

import { MaintenanceConfirmation } from "~/components/panel/settings/maintenance-confirmation";
import { SAVED_PARAM } from "~/lib/admin/settings-view";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { MAINTENANCE_MODE_SETTING } from "~/lib/maintenance-mode.server";
import {
  defineAdminAction,
  type AdminActionOutcome,
} from "~/lib/panel/admin-action.server";
import {
  buildMaintenanceValue,
  describeMaintenance,
} from "~/lib/panel/maintenance-settings.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import {
  readStoredSetting,
  replaceSetting,
} from "~/lib/panel/stored-setting.server";

import type { Route } from "./+types/maintenance";

const SEE_OTHER = 303;
const BAD_REQUEST = 400;

/** La pantalla de confirmación. Con el modo ya encendido no hay qué
 * confirmar. */
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<null> {
  const { client } = context.get(panelSessionContext);
  const stored = await readStoredSetting(MAINTENANCE_MODE_SETTING, client);
  if (describeMaintenance(stored) === "on") {
    throw redirect(getPanelPath("adminSettings", getRequestLanguage(request)));
  }
  return null;
}

type MaintenanceResult = Response | ReturnType<typeof data<null>>;

async function changeMaintenance({
  request,
  context,
}: Route.ActionArgs): Promise<AdminActionOutcome<MaintenanceResult, "value">> {
  const formData = await request.formData();
  const requested = formData.get("enabled");
  if (requested !== "true" && requested !== "false") {
    return { result: data(null, { status: BAD_REQUEST }), change: null };
  }
  const language = getRequestLanguage(request);
  const enabled = requested === "true";
  // Encender deja el sitio público sin verse: sin la confirmación no se toca
  // nada. Apagar no la pide.
  if (enabled && formData.get("confirm") !== "yes") {
    const confirmation = getPanelPath("adminSettingsMaintenance", language);
    return { result: redirect(confirmation, SEE_OTHER), change: null };
  }
  const { client } = context.get(panelSessionContext);
  const previous = await readStoredSetting(MAINTENANCE_MODE_SETTING, client);
  const change = await replaceSetting({
    client,
    key: MAINTENANCE_MODE_SETTING.key,
    previous,
    value: buildMaintenanceValue(previous, enabled),
  });
  const settingsPath = getPanelPath("adminSettings", language);
  return {
    result: redirect(`${settingsPath}?${SAVED_PARAM}=maintenance`, SEE_OTHER),
    change,
  };
}

export const action = defineAdminAction({
  name: "settings.set_maintenance",
  auditedFields: ["value"],
  run: changeMaintenance,
});

export default function PanelMaintenance(): ReactElement {
  return <MaintenanceConfirmation />;
}
