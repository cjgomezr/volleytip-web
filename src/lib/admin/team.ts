import type { MessageKey } from "../i18n/translate";

// Lo que comparten el servidor y las pantallas de "Equipo" (FR-058, FR-065).

export const TEAM_ROLES = ["admin", "staff"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export function isTeamRole(value: unknown): value is TeamRole {
  return TEAM_ROLES.some((role) => role === value);
}

export const MAX_MEMBER_NAME_LENGTH = 120;

export const INVITE_FIELDS = {
  name: "name",
  email: "email",
  role: "role",
} as const;

export const ROLE_FIELD = "role";
export const CONFIRM_FIELD = "confirm";
export const CONFIRM_VALUE = "yes";

/** Lo que la lista avisa al volver de otra pantalla. */
export const NOTICE_PARAM = "aviso";
export const TEAM_NOTICES = ["invited", "deactivated"] as const;
export type TeamNotice = (typeof TEAM_NOTICES)[number];

export interface TeamMemberView {
  readonly id: string;
  /** Nulo cuando el perfil no tiene nombre. */
  readonly name: string | null;
  readonly email: string;
  readonly role: TeamRole;
  readonly isActive: boolean;
  /** La fila de quien mira: no se le ofrece cambiarse. */
  readonly isSelf: boolean;
  /** Nulo cuando nunca ha entrado. */
  readonly lastSignIn: {
    /** La fecha para `<time>`. */
    readonly dateTime: string;
    readonly date: string;
  } | null;
}

export interface TeamListView {
  /** Los activos primero, por nombre. */
  readonly members: readonly TeamMemberView[];
  readonly notice: TeamNotice | null;
}

export interface DeactivationView {
  readonly member: Pick<TeamMemberView, "id" | "name" | "email">;
}

export type InviteValues = Readonly<Record<keyof typeof INVITE_FIELDS, string>>;

export interface InviteFieldErrors {
  readonly name?: "required" | "tooLong";
  readonly email?: "required" | "invalid";
  readonly role?: "invalid";
}

/** Cómo terminó una invitación que no cambió nada. La que sí, redirige. */
export type InviteOutcome =
  | {
      readonly status: "invalid";
      readonly fieldErrors: InviteFieldErrors;
      readonly values: InviteValues;
    }
  | {
      readonly status: "alreadyMember";
      readonly email: string;
      readonly isActive: boolean;
      readonly values: InviteValues;
    };

export type MemberRejection = "self" | "lastAdmin" | "malformed";

/** Cómo terminó un cambio sobre un miembro. */
export type MemberOutcome =
  | {
      readonly status: "roleChanged";
      readonly memberId: string;
      readonly role: TeamRole;
    }
  | { readonly status: "activated" | "unchanged"; readonly memberId: string }
  | {
      readonly status: "rejected";
      readonly memberId: string;
      readonly error: MemberRejection;
    };

export const ROLE_LABEL_KEYS: Readonly<Record<TeamRole, MessageKey>> = {
  admin: "panel.team.role.admin",
  staff: "panel.team.role.staff",
};

export const MEMBER_REJECTION_KEYS: Readonly<
  Record<MemberRejection, MessageKey>
> = {
  self: "panel.team.error.self",
  lastAdmin: "panel.team.error.lastAdmin",
  malformed: "panel.team.error.malformed",
};
