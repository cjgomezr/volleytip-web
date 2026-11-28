import type { ReactElement } from "react";
import { Form, Link, useNavigation } from "react-router";

import {
  CONFIRM_FIELD,
  CONFIRM_VALUE,
  MEMBER_REJECTION_KEYS,
  type DeactivationView,
  type MemberOutcome,
} from "~/lib/admin/team";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { Button, getButtonLinkClassName } from "../../button";
import { PanelHeading } from "../panel-heading";
import { RejectionAlert } from "./rejection-alert";

export interface DeactivateConfirmationProps extends DeactivationView {
  /** Por qué no se desactivó, si ya se intentó. */
  readonly outcome?: MemberOutcome;
}

/**
 * La confirmación para desactivar a alguien. Es una pantalla y no un diálogo:
 * así funciona igual sin JavaScript y con teclado.
 */
export function DeactivateConfirmation({
  member,
  outcome,
}: DeactivateConfirmationProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const action = getPanelPath("adminTeamDeactivate", language, {
    memberId: member.id,
  });
  const isSending = useNavigation().formAction === action;
  const error = outcome?.status === "rejected" ? outcome.error : undefined;
  return (
    <div className="max-w-[640px]">
      <PanelHeading title={translate("panel.team.confirm.title")} />
      <div className="mt-5 rounded-card bg-surface-light p-5 md:p-6">
        <p className="m-0 text-[18px] leading-[1.4] font-bold [overflow-wrap:anywhere]">
          {translate("panel.team.confirm.warning", {
            name: member.name ?? translate("panel.team.unnamed"),
            email: member.email,
          })}
        </p>
        <p className="mt-3 mb-0 text-[15px] leading-[1.5] text-ink-subtle">
          {translate("panel.team.confirm.details")}
        </p>
        {isSending || error === undefined ? null : (
          <div className="mt-4">
            <RejectionAlert text={translate(MEMBER_REJECTION_KEYS[error])} />
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Form method="post" action={action}>
            <input type="hidden" name={CONFIRM_FIELD} value={CONFIRM_VALUE} />
            <Button
              type="submit"
              zone="light"
              submittingLabel={
                isSending ? translate("panel.team.saving") : undefined
              }
            >
              {translate("panel.team.confirm.submit")}
            </Button>
          </Form>
          <Link
            to={getPanelPath("adminTeam", language)}
            className={getButtonLinkClassName("secondary", "light")}
          >
            {translate("panel.team.confirm.cancel")}
          </Link>
        </div>
      </div>
    </div>
  );
}
