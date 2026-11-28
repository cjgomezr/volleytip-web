import { redirect, type ActionFunctionArgs } from "react-router";

import { normalizeText } from "../admin/site-texts";
import {
  INVITE_FIELDS,
  isTeamRole,
  MAX_MEMBER_NAME_LENGTH,
  NOTICE_PARAM,
  type InviteFieldErrors,
  type InviteOutcome,
  type InviteValues,
  type TeamRole,
} from "../admin/team";
import type { Database } from "../database.types";
import { getRequestLanguage } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import { createServiceSupabaseClient } from "../supabase/service-client.server";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import {
  createConfirmedAccount,
  parseTeamEmail,
  secureAccount,
} from "../team-account.server";
import type { AdminActionOutcome } from "./admin-action.server";
import { findTextError, reject, type Rejection } from "./editor-input.server";
import { panelSessionContext } from "./panel-middleware.server";

const SEE_OTHER = 303;

type InviteResult = AdminActionOutcome<
  Response | Rejection<InviteOutcome>,
  "role" | "is_active" | "full_name"
>;

interface Invitation {
  readonly name: string;
  readonly email: string;
  readonly role: TeamRole;
}

type ParsedInvitation =
  | { readonly invitation: Invitation }
  | { readonly fieldErrors: InviteFieldErrors };

interface Profile {
  readonly id: string;
  readonly role: Database["public"]["Enums"]["user_role"];
  readonly is_active: boolean;
  readonly full_name: string | null;
}

function readValues(formData: FormData): InviteValues {
  const read = (field: string): string => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    name: read(INVITE_FIELDS.name),
    email: read(INVITE_FIELDS.email),
    role: read(INVITE_FIELDS.role),
  };
}

/** La invitación normalizada, o los errores de sus campos. */
function parseInvitation(values: InviteValues): ParsedInvitation {
  const name = normalizeText(values.name).replace(/\s+/g, " ");
  const email = parseTeamEmail(values.email);
  const nameError = findTextError(name, {
    maxLength: MAX_MEMBER_NAME_LENGTH,
    isRequired: true,
  });
  const role = isTeamRole(values.role) ? values.role : null;
  if (nameError === undefined && email !== null && role !== null) {
    return { invitation: { name, email, role } };
  }
  const emailError = values.email.trim() === "" ? "required" : "invalid";
  return {
    fieldErrors: {
      ...(nameError && { name: nameError }),
      ...(email === null && { email: emailError }),
      ...(role === null && { role: "invalid" }),
    },
  };
}

async function findProfile(
  client: TypedSupabaseClient,
  email: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, is_active, full_name")
    .eq("email", email)
    .maybeSingle();
  if (error !== null) {
    throw new Error(`No se pudo buscar el perfil: ${error.message}`, {
      cause: error,
    });
  }
  return data;
}

type Account =
  | { readonly createdId: string }
  /** El correo ya tenía un perfil. */
  | { readonly profile: Profile };

/** Busca el perfil del correo y, si no hay, crea la cuenta. */
async function findOrCreateAccount(
  client: TypedSupabaseClient,
  email: string,
): Promise<Account> {
  const found = await findProfile(client, email);
  if (found !== null) return { profile: found };
  // El registro público está apagado: solo la llave de servicio crea cuentas.
  const service = createServiceSupabaseClient();
  try {
    return { createdId: await createConfirmedAccount(service, email) };
  } catch (error) {
    // Otra invitación pudo crearla entre la búsqueda y este paso.
    const profile = await findProfile(client, email);
    if (profile === null) throw error;
    return { profile };
  }
}

/** Sube un comprador al equipo. `false` si ya no era comprador. */
async function promoteBuyer(
  client: TypedSupabaseClient,
  profileId: string,
  { name, role }: Invitation,
): Promise<boolean> {
  const { data, error } = await client
    .from("profiles")
    .update({ role, is_active: true, full_name: name })
    .eq("id", profileId)
    .eq("role", "buyer")
    .select("id");
  if (error !== null) {
    throw new Error(
      `No se pudo dar el rol al perfil ${profileId}: ${error.message}`,
      { cause: error },
    );
  }
  return data.length > 0;
}

function rejectExistingMember(
  { email, is_active }: Profile & { readonly email: string },
  values: InviteValues,
): InviteResult {
  return reject<InviteOutcome>({
    status: "alreadyMember",
    email,
    isActive: is_active,
    values,
  });
}

function describeInvitation(
  profileId: string,
  previous: Profile | null,
  { name, role }: Invitation,
): NonNullable<InviteResult["change"]> {
  return {
    entityId: profileId,
    // Sin `before`, la cuenta es nueva.
    before: previous && {
      role: previous.role,
      is_active: previous.is_active,
      full_name: previous.full_name,
    },
    after: { role, is_active: true, full_name: name },
  };
}

async function grantAccess(
  { request, context }: ActionFunctionArgs,
  invitation: Invitation,
  values: InviteValues,
): Promise<InviteResult> {
  const { client } = context.get(panelSessionContext);
  const { email } = invitation;
  const account = await findOrCreateAccount(client, email);
  const profile = "profile" in account ? account.profile : null;
  if (profile !== null && profile.role !== "buyer") {
    return rejectExistingMember({ ...profile, email }, values);
  }
  if (profile !== null) {
    await secureAccount(createServiceSupabaseClient(), profile.id);
  }
  const profileId =
    "createdId" in account ? account.createdId : account.profile.id;
  if (!(await promoteBuyer(client, profileId, invitation))) {
    // Otro admin invitó el mismo correo mientras tanto.
    const current = await findProfile(client, email);
    if (current === null || current.role === "buyer") {
      throw new Error(`No se pudo dar el rol al perfil ${profileId}`);
    }
    return rejectExistingMember({ ...current, email }, values);
  }
  const listPath = getPanelPath("adminTeam", getRequestLanguage(request));
  return {
    result: redirect(`${listPath}?${NOTICE_PARAM}=invited`, SEE_OTHER),
    change: describeInvitation(profileId, profile, invitation),
  };
}

/**
 * Invita a un correo: crea su cuenta o sube su cuenta de comprador, sin
 * enviarle nada. La persona entra pidiendo su enlace. La cuenta y el rol son
 * dos escrituras: si falla la segunda queda una cuenta de comprador, que no
 * abre el panel, y repetir la invitación la completa.
 */
export async function inviteMember(
  args: ActionFunctionArgs,
): Promise<InviteResult> {
  const values = readValues(await args.request.formData());
  const parsed = parseInvitation(values);
  if ("fieldErrors" in parsed) {
    return reject<InviteOutcome>({
      status: "invalid",
      fieldErrors: parsed.fieldErrors,
      values,
    });
  }
  return grantAccess(args, parsed.invitation, values);
}
