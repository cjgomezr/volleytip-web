import { useId, type ReactElement, type ReactNode } from "react";

import type {
  AppSettingsState,
  MaintenanceSettingsState,
} from "~/lib/admin/settings-view";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

type SettingState = MaintenanceSettingsState | AppSettingsState;

const STATE_LABELS: Record<SettingState, MessageKey> = {
  on: "panel.settings.state.on",
  off: "panel.settings.state.off",
  waitlist: "panel.settings.state.waitlist",
  available: "panel.settings.state.available",
  invalid: "panel.settings.state.invalid",
};

// El color acompaña al texto, que es el que dice el estado. Sobre rojo y
// lima el texto va en noche.
const STATE_STYLES: Record<SettingState, string> = {
  on: "bg-brand-red text-brand-night",
  off: "bg-line-light text-brand-night",
  waitlist: "bg-line-light text-brand-night",
  available: "bg-brand-lime text-brand-night",
  invalid: "bg-brand-red text-brand-night",
};

interface SettingsCardProps {
  readonly title: string;
  readonly state: SettingState;
  readonly children: ReactNode;
}

/** Un ajuste del panel: su nombre, su estado actual y sus controles. */
export function SettingsCard({
  title,
  state,
  children,
}: SettingsCardProps): ReactElement {
  const translate = useTranslate();
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-card bg-surface-light p-5 md:p-6"
    >
      <h2
        id={headingId}
        className="m-0 text-[18px] leading-[1.3] font-bold [overflow-wrap:anywhere]"
      >
        {title}
      </h2>
      <p className="mt-2.5 mb-0 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="text-ink-subtle">
          {translate("panel.settings.currentState")}
        </span>
        <span
          data-setting-state={state}
          className={`rounded-pill px-3 py-1 font-bold ${STATE_STYLES[state]}`}
        >
          {translate(STATE_LABELS[state])}
        </span>
      </p>
      {children}
    </section>
  );
}
