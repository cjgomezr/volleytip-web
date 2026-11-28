import {
  NOTICE_PARAM,
  TEAM_NOTICES,
  TEAM_ROLES,
  type TeamListView,
  type TeamMemberView,
  type TeamRole,
} from "../admin/team";
import { formatDate } from "../i18n/format";
import type { Language } from "../i18n/languages";
import { isUuid } from "../is-uuid";
import { createServiceSupabaseClient } from "../supabase/service-client.server";
import type { TypedSupabaseClient } from "../supabase/typed-client";

// El equipo como lo ve un admin. Los perfiles se leen con su sesión; solo el
// último ingreso pide la llave de servicio, porque vive en Supabase Auth. Quien
// llame tiene que haber comprobado antes que pide un admin.

const COLUMNS = "id, email, role, is_active, full_name";
const UNKNOWN_ACCOUNT_CODE = "user_not_found";

export interface TeamMember {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: TeamRole;
  readonly isActive: boolean;
}

interface ProfileRecord {
  readonly id: string;
  readonly email: unknown;
  readonly role: string;
  readonly is_active: boolean;
  readonly full_name: string | null;
}

function toTeamMember(record: ProfileRecord): TeamMember {
  return {
    id: record.id,
    email: String(record.email),
    name: record.full_name?.trim() || null,
    // La consulta ya filtra por los roles del equipo.
    role: record.role as TeamRole,
    isActive: record.is_active,
  };
}

function failReading(error: { message: string }): never {
  throw new Error(`No se pudo leer el equipo: ${error.message}`, {
    cause: error,
  });
}

/** Un miembro del equipo, o `null` si no existe o es un comprador. */
export async function readTeamMember(
  client: TypedSupabaseClient,
  id: string,
): Promise<TeamMember | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await client
    .from("profiles")
    .select(COLUMNS)
    .eq("id", id)
    .in("role", [...TEAM_ROLES]);
  if (error !== null) failReading(error);
  const [record] = data;
  return record === undefined ? null : toTeamMember(record);
}

async function readLastSignIn(
  service: TypedSupabaseClient,
  member: TeamMember,
  language: Language,
): Promise<TeamMemberView["lastSignIn"]> {
  const { data, error } = await service.auth.admin.getUserById(member.id);
  // Una cuenta metida a mano en la base, sin pasar por Auth, no la conoce su
  // API: nunca ha podido entrar, y no puede tumbar la lista de los demás.
  if (error?.code === UNKNOWN_ACCOUNT_CODE) return null;
  if (error !== null) failReading(error);
  const dateTime = data.user.last_sign_in_at;
  if (!dateTime) return null;
  const date = formatDate(new Date(dateTime), language, {
    style: "short",
    withTime: true,
  });
  return { dateTime, date };
}

function compareMembers(language: Language) {
  return (first: TeamMember, second: TeamMember): number =>
    Number(second.isActive) - Number(first.isActive) ||
    (first.name ?? first.email).localeCompare(
      second.name ?? second.email,
      language,
    );
}

interface ListOptions {
  readonly language: Language;
  readonly url: URL;
  /** Quien mira. */
  readonly viewerId: string;
}

/** Lo que pinta la lista: los admins y el staff, nunca los compradores. */
export async function readTeamList(
  client: TypedSupabaseClient,
  { language, url, viewerId }: ListOptions,
): Promise<TeamListView> {
  const { data, error } = await client
    .from("profiles")
    .select(COLUMNS)
    .in("role", [...TEAM_ROLES]);
  if (error !== null) failReading(error);
  const service = createServiceSupabaseClient();
  const members = await Promise.all(
    data
      .map(toTeamMember)
      .sort(compareMembers(language))
      .map(async (member) => ({
        ...member,
        isSelf: member.id === viewerId,
        lastSignIn: await readLastSignIn(service, member, language),
      })),
  );
  const asked = url.searchParams.get(NOTICE_PARAM);
  return {
    members,
    notice: TEAM_NOTICES.find((notice) => notice === asked) ?? null,
  };
}
