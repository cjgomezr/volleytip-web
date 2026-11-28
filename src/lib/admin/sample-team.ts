import type {
  DeactivationView,
  InviteOutcome,
  MemberOutcome,
  TeamListView,
  TeamMemberView,
} from "./team";

// Los datos de muestra del equipo (/dev/equipo), para capturar cada estado en
// Playwright sin sesión ni base. Son fijos.

export const SAMPLE_TEAM_STATES = [
  "lista",
  "invitada",
  "rechazo",
  "invitar",
  "errores",
  "ya-esta",
  "confirmar",
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

// Las fechas van ya escritas: la muestra no depende del reloj ni de la zona.
const MEMBERS: readonly TeamMemberView[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Andrés Gómez",
    email: "andres@example.com",
    role: "admin",
    isActive: true,
    isSelf: true,
    lastSignIn: {
      dateTime: "2026-11-27T14:05:00Z",
      date: "27/11/26, 9:05 a. m.",
    },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Mateo Gil",
    email: "mateo.gil.con.un.correo.bastante.largo@example.com",
    role: "admin",
    isActive: true,
    isSelf: false,
    lastSignIn: {
      dateTime: "2026-11-20T23:40:00Z",
      date: "20/11/26, 6:40 p. m.",
    },
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Sara Ruiz",
    email: "sara@example.com",
    role: "staff",
    isActive: true,
    isSelf: false,
    lastSignIn: null,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Lina Paz",
    email: "lina@example.com",
    role: "staff",
    isActive: false,
    isSelf: false,
    lastSignIn: {
      dateTime: "2026-10-02T13:15:00Z",
      date: "2/10/26, 8:15 a. m.",
    },
  },
];

const [SELF, OTHER_ADMIN, STAFF] = MEMBERS as readonly [
  TeamMemberView,
  TeamMemberView,
  TeamMemberView,
];

function lastAdminRejection(memberId: string): MemberOutcome {
  return { status: "rejected", memberId, error: "lastAdmin" };
}

function confirmationOf({ id, name, email }: TeamMemberView): DeactivationView {
  return { member: { id, name, email } };
}

const SAMPLES: Readonly<Record<SampleTeamState, SampleTeam>> = {
  lista: { screen: "list", view: { members: MEMBERS, notice: null } },
  invitada: { screen: "list", view: { members: MEMBERS, notice: "invited" } },
  rechazo: {
    screen: "list",
    view: { members: MEMBERS, notice: null },
    outcome: lastAdminRejection(OTHER_ADMIN.id),
  },
  invitar: { screen: "invite" },
  errores: {
    screen: "invite",
    outcome: {
      status: "invalid",
      fieldErrors: { name: "required", email: "invalid" },
      values: { name: "", email: "nora@", role: "admin" },
    },
  },
  "ya-esta": {
    screen: "invite",
    outcome: {
      status: "alreadyMember",
      email: SELF.email,
      isActive: true,
      values: { name: "Andrés", email: SELF.email, role: "staff" },
    },
  },
  confirmar: { screen: "confirmation", view: confirmationOf(STAFF) },
  "ultimo-admin": {
    screen: "confirmation",
    view: confirmationOf(OTHER_ADMIN),
    outcome: lastAdminRejection(OTHER_ADMIN.id),
  },
};

export function buildSampleTeam(state: SampleTeamState): SampleTeam {
  return SAMPLES[state];
}
