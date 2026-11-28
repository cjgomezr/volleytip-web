import type { ReactElement } from "react";

import {
  MEMBER_REJECTION_KEYS,
  ROLE_LABEL_KEYS,
  type MemberOutcome,
} from "~/lib/admin/team";
import { useTranslate } from "~/lib/i18n/translations-context";

import { UnsentNotice } from "../unsent-notice";
import { RejectionAlert } from "./rejection-alert";
import { SuccessNotice } from "./success-notice";

function useSuccessText(
  outcome: MemberOutcome | undefined,
  name: string,
): string | undefined {
  const translate = useTranslate();
  switch (outcome?.status) {
    case "roleChanged":
      return translate("panel.team.notice.roleChanged", {
        name,
        role: translate(ROLE_LABEL_KEYS[outcome.role]),
      });
    case "activated":
      return translate("panel.team.notice.activated", { name });
    case "unchanged":
      return translate("panel.team.notice.unchanged", { name });
    default:
      return undefined;
  }
}

/** En qué quedó el último envío de un miembro, junto a sus botones: en una
 * lista larga, un aviso arriba queda fuera de la pantalla. */
export function MemberFeedback({
  outcome,
  isUnsent,
  name,
}: {
  readonly outcome?: MemberOutcome;
  readonly isUnsent: boolean;
  readonly name: string;
}): ReactElement {
  const translate = useTranslate();
  const successText = useSuccessText(outcome, name);
  return (
    // El margen de desplazamiento deja el aviso por encima de la barra
    // inferior del celular. Vacío, no ocupa espacio.
    <div
      data-member-feedback
      className="scroll-mb-28 empty:-mt-3 md:scroll-mb-4"
    >
      <SuccessNotice text={successText} />
      {outcome?.status === "rejected" ? (
        <RejectionAlert
          text={translate(MEMBER_REJECTION_KEYS[outcome.error])}
        />
      ) : null}
      {isUnsent ? <UnsentNotice /> : null}
    </div>
  );
}
