import type { ReactElement } from "react";
import { Form, Link, useNavigation } from "react-router";

import { Button, getButtonLinkClassName } from "~/components/button";
import type { MaintenanceSettingsState } from "~/lib/admin/settings-view";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { SettingsCard } from "./settings-card";

const DESCRIPTIONS: Record<MaintenanceSettingsState, MessageKey> = {
  on: "panel.settings.maintenance.on",
  off: "panel.settings.maintenance.off",
  invalid: "panel.settings.maintenance.invalid",
};

/** Apagar no pide confirmación: es un envío directo. */
function TurnOffForm({ action }: { readonly action: string }): ReactElement {
  const translate = useTranslate();
  const isSending = useNavigation().formAction === action;
  return (
    <Form method="post" action={action}>
      <input type="hidden" name="enabled" value="false" />
      <Button
        type="submit"
        variant="secondary"
        zone="light"
        submittingLabel={
          isSending ? translate("panel.settings.saving") : undefined
        }
      >
        {translate("panel.settings.maintenance.turnOff")}
      </Button>
    </Form>
  );
}

/** El interruptor del mantenimiento. Encender lleva a la pantalla de
 * confirmación; con un valor inválido se ofrecen las dos salidas. */
export function MaintenanceCard({
  state,
}: {
  readonly state: MaintenanceSettingsState;
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
        {state === "off" ? null : <TurnOffForm action={path} />}
      </div>
    </SettingsCard>
  );
}
