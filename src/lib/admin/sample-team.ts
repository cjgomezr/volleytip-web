import { formatDate } from "../i18n/format";
import type { Language } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import type {
  DeactivationView,
  InviteOutcome,
  MemberOutcome,
  TeamListView,
  TeamMemberView,
  TeamNotice,
} from "./team";

// Los datos de muestra del equipo (/dev/equipo), para capturar cada estado en
// Playwright sin sesión ni base. Son fijos.

export const SAMPLE_TEAM_STATES = [
  "lista",
  "invitada",
  "rechazo",
  "cambiada",
  "invitar",
  "errores",
  "ya-esta",
  "confirmar",
  "sin-nombre",
  "ultimo-admin",
] as const;

export type SampleTeamState = (typeof SAMPLE_TEAM_STATES)[number];

export type SampleTeam =
  | {
      readonly screen: "list";
      readonly view: TeamListView;
      readonly outcome?: MemberOutcome;
    }
  | { readonly screen: "invite"; readonly outcome?: InviteOutcome }
  | {
      readonly screen: "confirmation";
      readonly view: DeactivationView;
      readonly outcome?: MemberOutcome;
    };

// Las fechas son fijas: la muestra no depende del reloj.
type SampleMember = Omit<TeamMemberView, "lastSignIn"> & {
  readonly signedInAt: string | null;
};

const MEMBERS: readonly SampleMember[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Andrés Gómez",
    email: "andres@example.com",
    role: "admin",
    isActive: true,
    isSelf: true,
    signedInAt: "2026-11-27T14:05:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Mateo Gil",
    email: "mateo.gil.con.un.correo.bastante.largo@example.com",
    role: "admin",
    isActive: true,
    isSelf: false,
    signedInAt: "2026-11-20T23:40:00Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Sara Ruiz",
    email: "sara@example.com",
    role: "staff",
    isActive: true,
    isSelf: false,
    signedInAt: null,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Lina Paz",
    email: "lina@example.com",
    role: "staff",
    isActive: false,
    isSelf: false,
    signedInAt: "2026-10-02T13:15:00Z",
  },
];

const [SELF, OTHER_ADMIN, STAFF] = MEMBERS as readonly [
  SampleMember,
  SampleMember,
  SampleMember,
];

function toView(
  { signedInAt, ...member }: SampleMember,
  language: Language,
): TeamMemberView {
  const lastSignIn =
    signedInAt === null
      ? null
      : {
          dateTime: signedInAt,
          date: formatDate(new Date(signedInAt), language, {
            style: "short",
            withTime: true,
          }),
        };
  return { ...member, lastSignIn };
}

function listOf(
  language: Language,
  { notice = null, outcome }: ListSample = {},
): SampleTeam {
  const signInPath = getPanelPath("adminSignIn", language);
  const view = {
    members: MEMBERS.map((member) => toView(member, language)),
    notice,
    signInUrl: `https://volleytip.com${signInPath}`,
  };
  return { screen: "list", view, outcome };
}

interface ListSample {
  readonly notice?: TeamNotice | null;
  readonly outcome?: MemberOutcome;
}

function lastAdminRejection(memberId: string): MemberOutcome {
  return { status: "rejected", memberId, error: "lastAdmin" };
}

function confirmationOf({ id, name, email }: SampleMember): DeactivationView {
  return { member: { id, name, email } };
}

const SAMPLES: Readonly<
  Record<SampleTeamState, (language: Language) => SampleTeam>
> = {
  lista: (language) => listOf(language),
  invitada: (language) => listOf(language, { notice: "invited" }),
  rechazo: (language) =>
    listOf(language, { outcome: lastAdminRejection(OTHER_ADMIN.id) }),
  cambiada: (language) =>
    listOf(language, {
      outcome: { status: "roleChanged", memberId: STAFF.id, role: "staff" },
    }),
  invitar: () => ({ screen: "invite" }),
  errores: () => ({
    screen: "invite",
    outcome: {
      status: "invalid",
      fieldErrors: { name: "required", email: "invalid" },
      values: { name: "", email: "nora@", role: "admin" },
    },
  }),
  "ya-esta": () => ({
    screen: "invite",
    outcome: {
      status: "alreadyMember",
      email: SELF.email,
      isActive: true,
      values: { name: "Andrés", email: SELF.email, role: "staff" },
    },
  }),
  confirmar: () => ({ screen: "confirmation", view: confirmationOf(STAFF) }),
  "sin-nombre": () => ({
    screen: "confirmation",
    view: confirmationOf({ ...STAFF, name: null }),
  }),
  "ultimo-admin": () => ({
    screen: "confirmation",
    view: confirmationOf(OTHER_ADMIN),
    outcome: lastAdminRejection(OTHER_ADMIN.id),
  }),
};

export function buildSampleTeam(
  state: SampleTeamState,
  language: Language,
): SampleTeam {
  return SAMPLES[state](language);
}
