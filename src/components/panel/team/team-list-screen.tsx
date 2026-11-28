import { useState, type ReactElement } from "react";
import { Link, useFetcher, type FetcherWithComponents } from "react-router";

import type { MemberOutcome, TeamListView, TeamNotice } from "~/lib/admin/team";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import {
  isUnsentSubmission,
  withoutUnsent,
  type UnsentSubmission,
} from "~/lib/panel/unsent-submission";
import { useAnswerOfThisLocation } from "~/lib/panel/use-panel-fetcher";
import { usePreloadSubmission } from "~/lib/panel/use-preload-submission";

import { getButtonLinkClassName } from "../../button";
import { PanelHeading } from "../panel-heading";
import { SuccessNotice } from "./success-notice";
import { TeamMemberCard } from "./team-member-card";
import { useTeamFocus } from "./use-team-focus";

// Lo que se avisa al volver de otra pantalla. Lo que pasa con un botón de la
// lista se avisa en su tarjeta.
function useReturnNoticeText(
  notice: TeamNotice | null,
  signInUrl: string,
): string | undefined {
  const translate = useTranslate();
  if (notice === null) return undefined;
  return notice === "invited"
    ? translate("panel.team.notice.invited", { url: signInUrl })
    : translate("panel.team.notice.deactivated");
}

interface ListSubmission {
  readonly fetcher: FetcherWithComponents<MemberOutcome | UnsentSubmission>;
  /** La respuesta del último envío, ya terminado. */
  readonly answer: MemberOutcome | UnsentSubmission | undefined;
  readonly outcome: MemberOutcome | undefined;
  readonly sentMemberId: string | undefined;
  readonly setSentMemberId: (memberId: string) => void;
  /** La fila donde se avisa que el envío no llegó. */
  readonly unsentMemberId: string | undefined;
}

/** El envío que comparten los botones de la lista, y en qué quedó el último. */
function useListSubmission(
  initialOutcome: MemberOutcome | undefined,
): ListSubmission {
  // `useFetcher` y no `usePanelFetcher`: los botones miran a dónde se está
  // enviando.
  const fetcher = useFetcher<MemberOutcome | UnsentSubmission>();
  usePreloadSubmission("adminTeamRole");
  usePreloadSubmission("adminTeamActivate");
  // Pulsar "Equipo" en el menú no desmonta la lista: la respuesta vence ahí.
  const current = useAnswerOfThisLocation(fetcher.data) as
    MemberOutcome | UnsentSubmission | undefined;
  const [sentMemberId, setSentMemberId] = useState<string>();
  const isIdle = fetcher.state === "idle";
  const answer = isIdle ? current : undefined;
  const isUnsent = isUnsentSubmission(answer);
  // Tras un envío que no llegó, lo anterior ya no es lo último que pasó.
  const outcome =
    isIdle && !isUnsent ? (withoutUnsent(answer) ?? initialOutcome) : undefined;
  return {
    fetcher,
    answer,
    outcome,
    sentMemberId,
    setSentMemberId,
    unsentMemberId: isUnsent ? sentMemberId : undefined,
  };
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
  signInUrl,
  initialOutcome,
}: TeamListScreenProps): ReactElement {
  const translate = useTranslate();
  const invitePath = getPanelPath("adminTeamInvite", useLanguage());
  const submission = useListSubmission(initialOutcome);
  const { fetcher, outcome, unsentMemberId } = submission;
  const listRef = useTeamFocus(submission.answer, submission.sentMemberId);
  const noticeText = useReturnNoticeText(notice, signInUrl);
  const hasSubmitted = submission.sentMemberId !== undefined;
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
      <div className="mt-4 empty:mt-0">
        <SuccessNotice text={hasSubmitted ? undefined : noticeText} />
      </div>
      <ul ref={listRef} className="mt-4 mb-0 flex list-none flex-col gap-3 p-0">
        {members.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            fetcher={fetcher}
            onSend={() => submission.setSentMemberId(member.id)}
            outcome={outcome?.memberId === member.id ? outcome : undefined}
            isUnsent={unsentMemberId === member.id}
          />
        ))}
      </ul>
    </div>
  );
}
