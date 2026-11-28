import type { ReactElement } from "react";
import { Link } from "react-router";

import { Button, getButtonLinkClassName } from "~/components/button";
import type { MaintenanceSettingsState } from "~/lib/admin/settings-view";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import type { PanelFetcher } from "~/lib/panel/use-panel-fetcher";
import { usePreloadSubmission } from "~/lib/panel/use-preload-submission";

import { UnsentNotice } from "../unsent-notice";
import { SettingsCard } from "./settings-card";

const DESCRIPTIONS: Record<MaintenanceSettingsState, MessageKey> = {
  on: "panel.settings.maintenance.on",
  off: "panel.settings.maintenance.off",
  invalid: "panel.settings.maintenance.invalid",
};

/** Apagar no pide confirmación: es un envío directo. */
function TurnOffForm({
  action,
  fetcher,
}: {
  readonly action: string;
  readonly fetcher: PanelFetcher<unknown>;
}): ReactElement {
  const translate = useTranslate();
  usePreloadSubmission("adminSettingsMaintenance");
  return (
    <fetcher.Form method="post" action={action}>
      <input type="hidden" name="enabled" value="false" />
      <Button
        type="submit"
        variant="secondary"
        zone="light"
        submittingLabel={
          fetcher.isSending ? translate("panel.settings.saving") : undefined
        }
      >
        {translate("panel.settings.maintenance.turnOff")}
      </Button>
    </fetcher.Form>
  );
}

/** El interruptor del mantenimiento. Encender lleva a la pantalla de
 * confirmación; con un valor inválido se ofrecen las dos salidas. */
export function MaintenanceCard({
  state,
  turnOff,
}: {
  readonly state: MaintenanceSettingsState;
  /** El envío que apaga el modo. */
  readonly turnOff: PanelFetcher<unknown>;
}): ReactElement {
  const translate = useTranslate();
  const path = getPanelPath("adminSettingsMaintenance", useLanguage());
  return (
    <SettingsCard
      title={translate("panel.settings.maintenance.title")}
      state={state}
    >
      <p className="mt-3 mb-0 text-[15px] leading-[1.5] text-ink-subtle">
        {translate(DESCRIPTIONS[state])}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {state === "on" ? null : (
          <Link
            to={path}
            className={getButtonLinkClassName("secondary", "light")}
          >
            {translate("panel.settings.maintenance.turnOn")}
          </Link>
        )}
        {state === "off" ? null : (
          <TurnOffForm action={path} fetcher={turnOff} />
        )}
      </div>
      {turnOff.isUnsent ? (
        <div className="mt-3">
          <UnsentNotice />
        </div>
      ) : null}
    </SettingsCard>
  );
}
