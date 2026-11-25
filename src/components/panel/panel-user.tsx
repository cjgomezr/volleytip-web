import type { ReactElement } from "react";

import { getInitials } from "~/lib/admin/initials";
import type { PanelRole } from "~/lib/admin/modules";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

const ROLE_LABEL_KEYS = {
  admin: "panel.role.admin",
  staff: "panel.role.staff",
} as const satisfies Record<PanelRole, MessageKey>;

export interface PanelUserData {
  /** El nombre del perfil o, si no tiene, el correo. */
  readonly displayName: string;
  readonly role: PanelRole;
}

/** Quién entró: iniciales, nombre y rol. */
export function PanelUser({ displayName, role }: PanelUserData): ReactElement {
  const translate = useTranslate();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-brand-red text-[14px] font-bold text-brand-night"
      >
        {getInitials(displayName)}
      </span>
      <p className="m-0 min-w-0 [overflow-wrap:anywhere]">
        <span className="block text-[14px] leading-[1.3] font-bold">
          {displayName}
        </span>
        <span className="block text-[12px] leading-[1.4] text-ink-muted">
          {translate(ROLE_LABEL_KEYS[role])}
        </span>
      </p>
    </div>
  );
}
