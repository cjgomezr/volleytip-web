import { useId, type ReactElement } from "react";
import { useLocation } from "react-router";

import { Button } from "~/components/button";
import { TextField } from "~/components/text-field";
import type {
  AppFormRejection,
  AppFormValues,
  AppSettingsView,
} from "~/lib/admin/settings-view";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import type { PanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { UnsentNotice } from "../unsent-notice";
import { SettingsCard } from "./settings-card";

const STATUS_OPTIONS = [
  { value: "waitlist", labelKey: "panel.settings.state.waitlist" },
  { value: "available", labelKey: "panel.settings.state.available" },
] as const satisfies readonly { value: string; labelKey: MessageKey }[];

interface StatusChoiceProps {
  readonly selected: string;
  readonly error: string | undefined;
}

// Radios nativos: funcionan con teclado y sin JavaScript.
function StatusChoice({ selected, error }: StatusChoiceProps): ReactElement {
  const translate = useTranslate();
  const errorId = useId();
  return (
    <fieldset
      className="m-0 border-0 p-0"
      aria-describedby={error === undefined ? undefined : errorId}
    >
      <legend className="mb-1.5 p-0 text-[14px] font-bold">
        {translate("panel.settings.app.statusLabel")}
      </legend>
      <div className="flex flex-wrap gap-x-6">
        {STATUS_OPTIONS.map(({ value, labelKey }) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[16px]"
          >
            <input
              type="radio"
              name="status"
              value={value}
              defaultChecked={selected === value}
              className="m-0 size-5 cursor-pointer accent-brand-night focused:outline-brand-night"
            />
            {translate(labelKey)}
          </label>
        ))}
      </div>
      {error === undefined ? null : (
        <p
          id={errorId}
          className="mt-1 mb-0 text-[14px] font-semibold text-brand-red-deep"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface AppFieldsProps {
  readonly values: AppFormValues;
  readonly errors: AppFormRejection["errors"];
}

function AppFields({ values, errors }: AppFieldsProps): ReactElement {
  const translate = useTranslate();
  const read = (key: MessageKey | undefined): string | undefined =>
    key === undefined ? undefined : translate(key);
  return (
    <>
      <StatusChoice selected={values.status} error={read(errors.status)} />
      <TextField
        zone="light"
        type="url"
        name="appStoreUrl"
        label={translate("panel.settings.app.appStoreLabel")}
        hint={translate("panel.settings.app.appStoreHint")}
        defaultValue={values.appStoreUrl}
        error={read(errors.appStoreUrl)}
      />
      <TextField
        zone="light"
        type="url"
        name="playStoreUrl"
        label={translate("panel.settings.app.playStoreLabel")}
        hint={translate("panel.settings.app.playStoreHint")}
        defaultValue={values.playStoreUrl}
        error={read(errors.playStoreUrl)}
      />
    </>
  );
}

export interface AppAvailabilityCardProps {
  readonly app: AppSettingsView;
  /** El envío del formulario; responde el rechazo si no se guardó. */
  readonly fetcher: PanelFetcher<AppFormRejection>;
}

/** El estado de la app: lista de espera o disponible, con sus direcciones. */
export function AppAvailabilityCard({
  app,
  fetcher,
}: AppAvailabilityCardProps): ReactElement {
  const translate = useTranslate();
  const path = getPanelPath("adminSettings", useLanguage());
  const rejection = fetcher.outcome;
  // Los campos son no controlados: cada navegación los vuelve a montar con lo
  // que el servidor guardó. Un envío rechazado, o que no llegó, no navega y
  // deja lo escrito.
  const { key } = useLocation();
  return (
    <SettingsCard
      title={translate("panel.settings.app.title")}
      state={app.state}
    >
      <p className="mt-3 mb-0 text-[15px] leading-[1.5] text-ink-subtle">
        {translate(
          app.state === "invalid"
            ? "panel.settings.app.invalid"
            : "panel.settings.app.details",
        )}
      </p>
      <fetcher.Form
        key={key}
        method="post"
        action={path}
        noValidate
        className="mt-5 flex flex-col gap-4"
      >
        {rejection === undefined ? null : (
          <p
            role="alert"
            className="m-0 text-[15px] font-semibold text-brand-red-deep"
          >
            {translate("panel.settings.app.error.summary")}
          </p>
        )}
        <AppFields
          values={rejection?.values ?? app.values}
          errors={rejection?.errors ?? {}}
        />
        <div className="flex flex-col items-start gap-3">
          {fetcher.isUnsent ? <UnsentNotice /> : null}
          <Button
            type="submit"
            zone="light"
            submittingLabel={
              fetcher.isSending ? translate("panel.settings.saving") : undefined
            }
          >
            {translate("panel.settings.app.save")}
          </Button>
        </div>
      </fetcher.Form>
    </SettingsCard>
  );
}
