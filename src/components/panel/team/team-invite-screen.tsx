import { useEffect, useRef, type ReactElement, type RefObject } from "react";
import { Link } from "react-router";

import {
  INVITE_FIELDS,
  MAX_MEMBER_NAME_LENGTH,
  ROLE_LABEL_KEYS,
  TEAM_ROLES,
  type InviteFieldErrors,
  type InviteOutcome,
} from "~/lib/admin/team";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { Button } from "../../button";
import { SelectField } from "../../select-field";
import { TextField } from "../../text-field";
import { TEXT_LINK_STYLES } from "../messages/message-styles";
import { PanelHeading } from "../panel-heading";
import { UnsentNotice } from "../unsent-notice";
import { RejectionAlert } from "./rejection-alert";

const DEFAULT_ROLE = "staff";

const NAME_ERROR_KEYS = {
  required: "panel.team.error.nameRequired",
  tooLong: "panel.team.error.nameTooLong",
} as const satisfies Readonly<Record<string, MessageKey>>;

const EMAIL_ERROR_KEYS = {
  required: "panel.team.error.emailRequired",
  invalid: "panel.team.error.emailInvalid",
} as const satisfies Readonly<Record<string, MessageKey>>;

function InviteFields({
  outcome,
}: {
  readonly outcome?: InviteOutcome;
}): ReactElement {
  const translate = useTranslate();
  const errors: InviteFieldErrors =
    outcome?.status === "invalid" ? outcome.fieldErrors : {};
  const values = outcome?.values;
  return (
    <div className="flex max-w-[480px] flex-col gap-5">
      <TextField
        zone="light"
        name={INVITE_FIELDS.name}
        label={translate("panel.team.field.name")}
        autoComplete="off"
        defaultValue={values?.name}
        error={
          errors.name &&
          translate(NAME_ERROR_KEYS[errors.name], {
            max: MAX_MEMBER_NAME_LENGTH,
          })
        }
        isRequired
      />
      <TextField
        zone="light"
        type="email"
        name={INVITE_FIELDS.email}
        label={translate("panel.team.field.email")}
        autoComplete="off"
        defaultValue={values?.email}
        error={errors.email && translate(EMAIL_ERROR_KEYS[errors.email])}
        isRequired
      />
      <div>
        <SelectField
          zone="light"
          name={INVITE_FIELDS.role}
          label={translate("panel.team.field.role")}
          defaultValue={values?.role || DEFAULT_ROLE}
          options={TEAM_ROLES.map((role) => ({
            value: role,
            label: translate(ROLE_LABEL_KEYS[role]),
          }))}
          error={errors.role && translate("panel.team.error.role")}
        />
        <p className="mt-2 mb-0 text-[13px] leading-[1.5] text-ink-subtle">
          {translate("panel.team.roleHint")}
        </p>
      </div>
    </div>
  );
}

function useOutcomeText(
  outcome: InviteOutcome | undefined,
): string | undefined {
  const translate = useTranslate();
  if (outcome === undefined) return undefined;
  if (outcome.status === "invalid") {
    return translate("panel.team.error.summary");
  }
  return translate(
    outcome.isActive
      ? "panel.team.alreadyMember"
      : "panel.team.alreadyMemberInactive",
    { email: outcome.email },
  );
}

/** Tras un rechazo lleva el foco al primer campo marcado. */
function useFirstErrorFocus(
  outcome: InviteOutcome | undefined,
): RefObject<HTMLDivElement | null> {
  const fieldsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fieldsRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [outcome]);
  return fieldsRef;
}

/** El formulario para invitar a alguien al equipo. Va dentro de
 * `PanelShell`. */
export function TeamInviteScreen({
  initialOutcome,
}: {
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: InviteOutcome;
}): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const action = getPanelPath("adminTeamInvite", language);
  const { Form, isSending, isUnsent, outcome } =
    usePanelFetcher<InviteOutcome>(initialOutcome);
  const outcomeText = useOutcomeText(outcome);
  const fieldsRef = useFirstErrorFocus(outcome);
  return (
    <div className="max-w-[640px]">
      <PanelHeading title={translate("panel.team.inviteTitle")} />
      <Link
        to={getPanelPath("adminTeam", language)}
        className={`mt-2 ${TEXT_LINK_STYLES}`}
      >
        {translate("panel.team.back")}
      </Link>
      <div
        ref={fieldsRef}
        className="mt-3 rounded-card bg-surface-light p-4 md:p-6"
      >
        <p className="mt-0 mb-5 text-[14px] leading-[1.5] text-ink-subtle">
          {translate("panel.team.inviteIntro")}
        </p>
        <Form method="post" action={action} noValidate>
          <InviteFields outcome={outcome} />
          <div className="mt-6 flex flex-col items-start gap-3">
            {isUnsent ? <UnsentNotice /> : null}
            {isSending || isUnsent || outcomeText === undefined ? null : (
              <RejectionAlert text={outcomeText} />
            )}
            <Button
              type="submit"
              zone="light"
              submittingLabel={
                isSending ? translate("panel.team.submitting") : undefined
              }
            >
              {translate("panel.team.submit")}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
