import type { ReactElement } from "react";

import type {
  AppFormRejection,
  SavedSetting,
  SettingsView,
} from "~/lib/admin/settings-view";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { PanelHeading } from "../panel-heading";
import { AppAvailabilityCard } from "./app-availability-card";
import { MaintenanceCard } from "./maintenance-card";

const SAVED_MESSAGES: Record<SavedSetting, MessageKey> = {
  maintenance: "panel.settings.saved.maintenance",
  app: "panel.settings.saved.app",
};

export interface SettingsScreenProps extends SettingsView {
  /** La respuesta de un envío sin JavaScript. */
  readonly rejection?: AppFormRejection;
}

/** La pantalla "Ajustes". Va dentro de `PanelShell`. */
export function SettingsScreen({
  maintenance,
  app,
  saved,
  rejection,
}: SettingsScreenProps): ReactElement {
  const translate = useTranslate();
  const appForm = usePanelFetcher<AppFormRejection>(rejection);
  const turnOff = usePanelFetcher();
  // El aviso de guardado es de un envío anterior: no se deja junto al de uno
  // que no se guardó.
  const hasFailedSubmission =
    appForm.outcome !== undefined || appForm.isUnsent || turnOff.isUnsent;
  return (
    <div className="max-w-[640px]">
      <PanelHeading title={translate("panel.module.settings")} />
      {/* La región existe siempre: un lector de pantalla solo anuncia lo que
          cambia dentro de una región que ya estaba en la página. */}
      <div role="status">
        {saved === null || hasFailedSubmission ? null : (
          <p className="mt-5 mb-0 rounded-control border-2 border-brand-night bg-brand-lime px-4 py-3 text-[15px] font-bold text-brand-night">
            {translate(SAVED_MESSAGES[saved])}
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-col gap-4">
        <MaintenanceCard state={maintenance} turnOff={turnOff} />
        <AppAvailabilityCard app={app} fetcher={appForm} />
      </div>
    </div>
  );
}
