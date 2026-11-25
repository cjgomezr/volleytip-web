import type { ReactElement } from "react";
import { Form, Link, useNavigation } from "react-router";

import { Button, getButtonLinkClassName } from "~/components/button";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { PanelHeading } from "../panel-heading";

/**
 * La confirmación para encender el mantenimiento. Es una pantalla y no un
 * diálogo: así funciona igual sin JavaScript y con teclado.
 */
export function MaintenanceConfirmation(): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const action = getPanelPath("adminSettingsMaintenance", language);
  const isSending = useNavigation().formAction === action;
  return (
    <div className="max-w-[640px]">
      <PanelHeading title={translate("panel.settings.confirm.title")} />
      <div className="mt-5 rounded-card bg-surface-light p-5 md:p-6">
        <p className="m-0 text-[18px] leading-[1.4] font-bold">
          {translate("panel.settings.confirm.warning")}
        </p>
        <p className="mt-3 mb-0 text-[15px] leading-[1.5] text-ink-subtle">
          {translate("panel.settings.confirm.details")}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Form method="post" action={action}>
            <input type="hidden" name="enabled" value="true" />
            <input type="hidden" name="confirm" value="yes" />
            <Button
              type="submit"
              zone="light"
              submittingLabel={
                isSending ? translate("panel.settings.saving") : undefined
              }
            >
              {translate("panel.settings.confirm.submit")}
            </Button>
          </Form>
          <Link
            to={getPanelPath("adminSettings", language)}
            className={getButtonLinkClassName("secondary", "light")}
          >
            {translate("panel.settings.confirm.cancel")}
          </Link>
        </div>
      </div>
    </div>
  );
}
