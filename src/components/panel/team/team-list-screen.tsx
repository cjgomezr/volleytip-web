import type { ReactElement } from "react";
import { Link, useFetcher } from "react-router";

import {
  ROLE_LABEL_KEYS,
  type MemberOutcome,
  type TeamListView,
  type TeamNotice,
} from "~/lib/admin/team";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import {
  isUnsentSubmission,
  withoutUnsent,
  type UnsentSubmission,
} from "~/lib/panel/unsent-submission";
import { usePreloadSubmission } from "~/lib/panel/use-preload-submission";

import { getButtonLinkClassName } from "../../button";
import { PanelHeading } from "../panel-heading";
import { UnsentNotice } from "../unsent-notice";
import { TeamMemberCard } from "./team-member-card";
import { useTeamFocus } from "./use-team-focus";

function useNoticeText(
  outcome: MemberOutcome | undefined,
  notice: TeamNotice | null,
): string | undefined {
  const translate = useTranslate();
  const signInPath = getPanelPath("adminSignIn", useLanguage());
  if (outcome === undefined) {
    if (notice === "invited") {
      return translate("panel.team.notice.invited", { path: signInPath });
    }
    return notice === null
      ? undefined
      : translate("panel.team.notice.deactivated");
  }
  switch (outcome.status) {
    case "roleChanged":
      return translate("panel.team.notice.roleChanged", {
        role: translate(ROLE_LABEL_KEYS[outcome.role]),
      });
    case "activated":
      return translate("panel.team.notice.activated");
    case "unchanged":
      return translate("panel.team.notice.unchanged");
    case "rejected":
      return undefined;
  }
}

// La región existe siempre: un lector de pantalla solo anuncia lo que cambia
// dentro de una región que ya estaba en la página.
function Notice({ text }: { readonly text?: string }): ReactElement {
  return (
    <div role="status">
      {text === undefined ? null : (
        <p className="mt-4 mb-0 flex w-fit max-w-full items-start gap-2 rounded-card bg-brand-lime px-4 py-2 text-[15px] leading-[1.5] font-bold text-brand-night [overflow-wrap:anywhere]">
          <span aria-hidden="true">✓</span>
          {text}
        </p>
      )}
    </div>
  );
}

export interface TeamListScreenProps extends TeamListView {
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: MemberOutcome;
}

/** El equipo del panel (FR-058): admins y staff. Va dentro de
 * `PanelShell`. */
export function TeamListScreen({
  members,
  notice,
  initialOutcome,
}: TeamListScreenProps): ReactElement {
  const translate = useTranslate();
  const invitePath = getPanelPath("adminTeamInvite", useLanguage());
  // Uno solo para todos los botones: lo último que pasó es lo que se anuncia.
  // `useFetcher` y no `usePanelFetcher`: los botones miran a dónde se está
  // enviando. La lista se desmonta al cambiar de dirección, así que sus
  // respuestas no hay que vencerlas.
  const fetcher = useFetcher<MemberOutcome | UnsentSubmission>();
  usePreloadSubmission("adminTeamRole");
  usePreloadSubmission("adminTeamActivate");
  const isIdle = fetcher.state === "idle";
  const answer = isIdle ? fetcher.data : undefined;
  const isUnsent = isUnsentSubmission(answer);
  const answered = withoutUnsent(answer);
  // Tras un envío que no llegó, lo anterior ya no es lo último que pasó.
  const isSettled = isIdle && !isUnsent;
  const outcome = isSettled ? (answered ?? initialOutcome) : undefined;
  const listRef = useTeamFocus(answered);
  const noticeText = useNoticeText(outcome, isSettled ? notice : null);
  return (
    <div className="max-w-[900px]">
      <PanelHeading title={translate("panel.module.team")} />
      <p className="mt-3 mb-4 text-[14px] leading-[1.5] text-ink-subtle">
        {translate("panel.team.intro")}
      </p>
      <Link
        to={invitePath}
        className={getButtonLinkClassName("primary", "light")}
      >
        {translate("panel.team.invite")}
      </Link>
      <Notice text={noticeText} />
      {isUnsent ? (
        <div className="mt-4">
          <UnsentNotice />
        </div>
      ) : null}
      <ul ref={listRef} className="mt-4 mb-0 flex list-none flex-col gap-3 p-0">
        {members.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            fetcher={fetcher}
            error={
              outcome?.status === "rejected" && outcome.memberId === member.id
                ? outcome.error
                : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}
