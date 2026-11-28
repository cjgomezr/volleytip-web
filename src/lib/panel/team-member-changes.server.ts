import { data, redirect, type ActionFunctionArgs } from "react-router";

import {
  CONFIRM_FIELD,
  CONFIRM_VALUE,
  isTeamRole,
  NOTICE_PARAM,
  ROLE_FIELD,
  type MemberOutcome,
  type MemberRejection,
} from "../admin/team";
import { getRequestLanguage } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { findBrokenRule } from "./database-rule.server";
import type { AdminActionOutcome } from "./admin-action.server";
import {
  reject,
  type Rejection,
  type SaveOutcome,
} from "./editor-input.server";
import {
  panelMemberContext,
  panelSessionContext,
} from "./panel-middleware.server";
import { readTeamMember, type TeamMember } from "./team-reader.server";

// Cambiar el rol, desactivar y activar. No hay borrar (DR-006). La base
// rechaza dejar el panel sin un admin activo.

const NOT_FOUND_STATUS = 404;
const SEE_OTHER = 303;
const LAST_ADMIN_RULE = "profiles_last_admin_check";

type MemberResult<Field extends string> = SaveOutcome<MemberOutcome, Field>;
type DeactivationResult = AdminActionOutcome<
  Response | Rejection<MemberOutcome>,
  "is_active"
>;

// La dirección admite el id en mayúsculas y la base lo trata como el mismo:
// se compara siempre en minúsculas, o "a sí mismo" se podría esquivar.
function readMemberId({ params }: ActionFunctionArgs): string {
  return (params.memberId ?? "").toLowerCase();
}

async function findMember(
  client: TypedSupabaseClient,
  memberId: string,
): Promise<TeamMember> {
  const member = await readTeamMember(client, memberId);
  if (member === null) throw data(null, { status: NOT_FOUND_STATUS });
  return member;
}

function rejectChange(
  memberId: string,
  error: MemberRejection,
): { result: Rejection<MemberOutcome>; change: null } {
  return reject<MemberOutcome>({ status: "rejected", memberId, error });
}

function unchanged(memberId: string): {
  result: MemberOutcome;
  change: null;
} {
  return { result: { status: "unchanged", memberId }, change: null };
}

type ProfileChange =
  { readonly role: TeamMember["role"] } | { readonly is_active: boolean };

/** Escribe con la sesión de la persona, y solo si el perfil sigue como se
 * leyó: `unchanged` es que otra persona se adelantó. */
async function writeProfile(
  client: TypedSupabaseClient,
  member: TeamMember,
  change: ProfileChange,
): Promise<"written" | "unchanged" | "lastAdmin"> {
  const [column, previous] =
    "role" in change
      ? (["role", member.role] as const)
      : (["is_active", member.isActive] as const);
  const { data: rows, error } = await client
    .from("profiles")
    .update(change)
    .eq("id", member.id)
    .eq(column, previous)
    .select("id");
  if (error !== null) {
    if (findBrokenRule(error, [LAST_ADMIN_RULE])) return "lastAdmin";
    throw new Error(
      `No se pudo cambiar el perfil ${member.id}: ${error.message}`,
      { cause: error },
    );
  }
  return rows.length === 0 ? "unchanged" : "written";
}

/** Pasa a un miembro entre admin y staff. */
export async function changeMemberRole(
  args: ActionFunctionArgs,
): Promise<MemberResult<"role">> {
  const memberId = readMemberId(args);
  const role = (await args.request.formData()).get(ROLE_FIELD);
  if (!isTeamRole(role)) return rejectChange(memberId, "malformed");
  const actor = args.context.get(panelMemberContext);
  if (memberId === actor.id && role !== actor.role) {
    return rejectChange(memberId, "self");
  }
  const { client } = args.context.get(panelSessionContext);
  const member = await findMember(client, memberId);
  if (member.role === role) return unchanged(memberId);
  const written = await writeProfile(client, member, { role });
  if (written === "lastAdmin") return rejectChange(memberId, written);
  if (written === "unchanged") return unchanged(memberId);
  return {
    result: { status: "roleChanged", memberId, role },
    change: {
      entityId: memberId,
      before: { role: member.role },
      after: { role },
    },
  };
}

function activationChange(
  memberId: string,
  isActive: boolean,
): NonNullable<DeactivationResult["change"]> {
  return {
    entityId: memberId,
    before: { is_active: !isActive },
    after: { is_active: isActive },
  };
}

/** Desactiva a un miembro, ya confirmado. Pierde el acceso en su siguiente
 * petición: la guardia lee `is_active` cada vez. */
export async function deactivateMember(
  args: ActionFunctionArgs,
): Promise<DeactivationResult> {
  const memberId = readMemberId(args);
  const actor = args.context.get(panelMemberContext);
  if (memberId === actor.id) return rejectChange(memberId, "self");
  const { client } = args.context.get(panelSessionContext);
  const member = await findMember(client, memberId);
  const language = getRequestLanguage(args.request);
  const formData = await args.request.formData();
  if (formData.get(CONFIRM_FIELD) !== CONFIRM_VALUE) {
    const confirmation = getPanelPath("adminTeamDeactivate", language, {
      memberId,
    });
    return { result: redirect(confirmation, SEE_OTHER), change: null };
  }
  const listPath = getPanelPath("adminTeam", language);
  if (!member.isActive) {
    return { result: redirect(listPath, SEE_OTHER), change: null };
  }
  const written = await writeProfile(client, member, { is_active: false });
  if (written === "lastAdmin") return rejectChange(memberId, written);
  if (written === "unchanged") {
    return { result: redirect(listPath, SEE_OTHER), change: null };
  }
  return {
    result: redirect(`${listPath}?${NOTICE_PARAM}=deactivated`, SEE_OTHER),
    change: activationChange(memberId, false),
  };
}

/** Vuelve a activar a un miembro desactivado. */
export async function activateMember(
  args: ActionFunctionArgs,
): Promise<MemberResult<"is_active">> {
  const memberId = readMemberId(args);
  const { client } = args.context.get(panelSessionContext);
  const member = await findMember(client, memberId);
  if (member.isActive) return unchanged(memberId);
  const written = await writeProfile(client, member, { is_active: true });
  // Activar nunca quita un admin.
  if (written !== "written") return unchanged(memberId);
  return {
    result: { status: "activated", memberId },
    change: activationChange(memberId, true),
  };
}
