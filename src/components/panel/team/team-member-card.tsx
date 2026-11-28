import type { ReactElement } from "react";
import { Link, type FetcherWithComponents } from "react-router";

import {
  ROLE_FIELD,
  ROLE_LABEL_KEYS,
  type MemberOutcome,
  type TeamMemberView,
} from "~/lib/admin/team";
import { getPanelPath, type PanelPageId } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import type { UnsentSubmission } from "~/lib/panel/unsent-submission";

import { Button, getButtonLinkClassName } from "../../button";
import { MemberFeedback } from "./member-feedback";
import type { TeamControl } from "./use-team-focus";

type TeamFetcher = FetcherWithComponents<MemberOutcome | UnsentSubmission>;

interface TeamMemberCardProps {
  readonly member: TeamMemberView;
  /** El envío que comparten los botones de la lista. */
  readonly fetcher: TeamFetcher;
  /** Avisa que esta tarjeta es la que envía, y con cuál botón. */
  readonly onSend: (control: TeamControl) => void;
  /** El resultado llegó con la página y no de un envío de esta pantalla. */
  readonly isFromPageLoad: boolean;
  /** En qué quedó el último envío, si fue de este miembro. */
  readonly outcome?: MemberOutcome;
  readonly isUnsent: boolean;
}

const BADGE_STYLES =
  "inline-block rounded-pill px-3 py-1 text-[13px] leading-[1.4] font-bold";

// El color acompaña al texto, que es el que dice el estado.
function MemberBadges({
  role,
  isActive,
}: Pick<TeamMemberView, "role" | "isActive">): ReactElement {
  const translate = useTranslate();
  return (
    <p className="m-0 flex flex-wrap gap-2">
      <span
        data-member-role={role}
        className={`${BADGE_STYLES} bg-brand-night text-brand-mist`}
      >
        {translate(ROLE_LABEL_KEYS[role])}
      </span>
      <span
        data-member-active={isActive}
        className={`${BADGE_STYLES} text-brand-night ${isActive ? "bg-brand-lime" : "bg-line-light"}`}
      >
        {translate(
          isActive ? "panel.team.state.active" : "panel.team.state.inactive",
        )}
      </span>
    </p>
  );
}

function LastSignIn({
  lastSignIn,
}: Pick<TeamMemberView, "lastSignIn">): ReactElement {
  const translate = useTranslate();
  return (
    <p className="m-0 text-[14px] leading-[1.5] text-ink-subtle">
      {translate("panel.team.lastSignIn")}{" "}
      {lastSignIn === null ? (
        translate("panel.team.neverSignedIn")
      ) : (
        <time dateTime={lastSignIn.dateTime}>{lastSignIn.date}</time>
      )}
    </p>
  );
}

interface MemberButtonProps {
  readonly fetcher: TeamFetcher;
  readonly onSend: (control: TeamControl) => void;
  readonly control: TeamControl;
  readonly page: PanelPageId;
  readonly memberId: string;
  /** Lo que el botón manda además de la dirección. */
  readonly role?: TeamMemberView["role"];
  readonly text: string;
  readonly label: string;
}

function MemberButton({
  fetcher,
  onSend,
  control,
  page,
  memberId,
  role,
  text,
  label,
}: MemberButtonProps): ReactElement {
  const translate = useTranslate();
  const action = getPanelPath(page, useLanguage(), { memberId });
  const isBusy = fetcher.state !== "idle";
  return (
    <fetcher.Form
      method="post"
      action={action}
      data-team-control={control}
      // Un envío nuevo cancelaría el que está en curso, que podría no llegar a
      // guardarse.
      onSubmit={(event) => {
        if (isBusy) event.preventDefault();
        else onSend(control);
      }}
    >
      {role === undefined ? null : (
        <input type="hidden" name={ROLE_FIELD} value={role} />
      )}
      <Button
        type="submit"
        variant="secondary"
        zone="light"
        aria-label={label}
        submittingLabel={
          isBusy && fetcher.formAction === action
            ? translate("panel.team.saving")
            : undefined
        }
      >
        {text}
      </Button>
    </fetcher.Form>
  );
}

function MemberActions({
  member,
  name,
  fetcher,
  onSend,
}: {
  readonly member: TeamMemberView;
  readonly name: string;
  readonly fetcher: TeamFetcher;
  readonly onSend: (control: TeamControl) => void;
}): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const shared = { fetcher, onSend, memberId: member.id };
  const isAdmin = member.role === "admin";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MemberButton
        {...shared}
        control="role"
        page="adminTeamRole"
        role={isAdmin ? "staff" : "admin"}
        text={translate(
          isAdmin ? "panel.team.makeStaff" : "panel.team.makeAdmin",
        )}
        label={translate(
          isAdmin ? "panel.team.makeStaffLabel" : "panel.team.makeAdminLabel",
          { name },
        )}
      />
      {member.isActive ? (
        <Link
          to={getPanelPath("adminTeamDeactivate", language, {
            memberId: member.id,
          })}
          aria-label={translate("panel.team.deactivateLabel", { name })}
          data-team-control="access"
          className={getButtonLinkClassName("secondary", "light")}
        >
          {translate("panel.team.deactivate")}
        </Link>
      ) : (
        <MemberButton
          {...shared}
          control="access"
          page="adminTeamActivate"
          text={translate("panel.team.activate")}
          label={translate("panel.team.activateLabel", { name })}
        />
      )}
    </div>
  );
}

/** Un miembro del equipo, con sus datos y sus botones. A quien mira no se le
 * ofrece cambiarse, y a nadie se le ofrece borrar (DR-006). */
export function TeamMemberCard({
  member,
  fetcher,
  onSend,
  outcome,
  isUnsent,
  isFromPageLoad,
}: TeamMemberCardProps): ReactElement {
  const translate = useTranslate();
  const name = member.name ?? translate("panel.team.unnamed");
  // Sin nombre, el correo distingue a quién cambia cada botón y cada aviso.
  const distinctName = member.name ?? member.email;
  return (
    <li
      data-member-row={member.id}
      className="flex min-w-0 flex-col gap-3 rounded-card bg-surface-light p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="m-0 text-[17px] leading-[1.4] font-bold [overflow-wrap:anywhere]">
          {name}
        </h2>
        <MemberBadges role={member.role} isActive={member.isActive} />
      </div>
      <p className="m-0 text-[15px] leading-[1.5] [overflow-wrap:anywhere]">
        {member.email}
      </p>
      <LastSignIn lastSignIn={member.lastSignIn} />
      {member.isSelf ? (
        <p className="m-0 text-[14px] leading-[1.5] font-semibold">
          {translate("panel.team.you")}
        </p>
      ) : (
        <MemberActions
          member={member}
          name={distinctName}
          fetcher={fetcher}
          onSend={onSend}
        />
      )}
      {member.isSelf && outcome === undefined ? null : (
        <MemberFeedback
          outcome={outcome}
          isUnsent={isUnsent}
          name={distinctName}
          isFromPageLoad={isFromPageLoad && outcome !== undefined}
        />
      )}
    </li>
  );
}
