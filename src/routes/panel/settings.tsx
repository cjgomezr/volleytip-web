import type { ReactElement } from "react";
import { data, redirect } from "react-router";

import { SettingsScreen } from "~/components/panel/settings/settings-screen";
import {
  SAVED_PARAM,
  type AppFormRejection,
  type SavedSetting,
  type SettingsView,
} from "~/lib/admin/settings-view";
import { APP_AVAILABILITY_SETTING } from "~/lib/app-availability.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { MAINTENANCE_MODE_SETTING } from "~/lib/maintenance-mode.server";
import {
  defineAdminAction,
  type AdminActionOutcome,
} from "~/lib/panel/admin-action.server";
import {
  describeAppSettings,
  readAppForm,
  reviewAppForm,
} from "~/lib/panel/app-availability-settings.server";
import { describeMaintenance } from "~/lib/panel/maintenance-settings.server";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import {
  readStoredSetting,
  replaceSetting,
} from "~/lib/panel/stored-setting.server";

import type { Route } from "./+types/settings";

const SEE_OTHER = 303;
const BAD_REQUEST = 400;

function readSaved(request: Request): SavedSetting | null {
  const saved = new URL(request.url).searchParams.get(SAVED_PARAM);
  return saved === "maintenance" || saved === "app" ? saved : null;
}

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<SettingsView> {
  const { client } = context.get(panelSessionContext);
  const [maintenance, app] = await Promise.all([
    readStoredSetting(MAINTENANCE_MODE_SETTING, client),
    readStoredSetting(APP_AVAILABILITY_SETTING, client),
  ]);
  return {
    maintenance: describeMaintenance(maintenance),
    app: describeAppSettings(app),
    saved: readSaved(request),
  };
}

type AppResult = Response | ReturnType<typeof data<AppFormRejection>>;

async function changeAppAvailability({
  request,
  context,
}: Route.ActionArgs): Promise<AdminActionOutcome<AppResult, "value">> {
  const values = readAppForm(await request.formData());
  const { client } = context.get(panelSessionContext);
  const previous = await readStoredSetting(APP_AVAILABILITY_SETTING, client);
  const review = reviewAppForm(values, previous);
  if (!review.isValid) {
    return {
      result: data({ errors: review.errors, values }, { status: BAD_REQUEST }),
      change: null,
    };
  }
  const change = await replaceSetting({
    client,
    key: APP_AVAILABILITY_SETTING.key,
    previous,
    value: review.value,
  });
  const settingsPath = getPanelPath(
    "adminSettings",
    getRequestLanguage(request),
  );
  return {
    result: redirect(`${settingsPath}?${SAVED_PARAM}=app`, SEE_OTHER),
    change,
  };
}

// El envío de esta pantalla es el del estado de la app. El mantenimiento
// envía a su propia ruta: una ruta, una acción.
export const action = defineAdminAction({
  name: "settings.set_app_availability",
  auditedFields: ["value"],
  run: changeAppAvailability,
});

export default function PanelSettings({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <SettingsScreen {...loaderData} rejection={actionData} />;
}
