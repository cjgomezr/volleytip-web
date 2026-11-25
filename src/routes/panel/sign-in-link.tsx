import type { ReactElement } from "react";
import { data, redirect } from "react-router";

import {
  SignInLinkScreen,
  type SignInLinkOutcome,
} from "~/components/panel/sign-in-link-screen";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { redeemSignInLink } from "~/lib/panel/redeem-sign-in-link.server";
import {
  buildSignInPathFor,
  findRequestedPage,
  readReturnTarget,
  resolveSignedInPath,
  RETURN_PARAM,
} from "~/lib/panel/return-path";

import type { Route } from "./+types/sign-in-link";

const BAD_REQUEST_STATUS = 400;
const SERVICE_UNAVAILABLE_STATUS = 503;
// El nombre que escribe la plantilla del correo.
const TOKEN_PARAM = "token_hash";
// Un hash en hexadecimal, a veces con prefijo. Lo demás no se le manda a Auth.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{20,200}$/;

function readToken(value: unknown): string | null {
  return typeof value === "string" && TOKEN_FORMAT.test(value) ? value : null;
}

// La dirección de regreso llega completa desde el correo y como ruta desde el
// formulario.
function readRequestedPage(value: unknown): string | null {
  return typeof value === "string"
    ? findRequestedPage(readReturnTarget(value))
    : null;
}

// Solo mira la dirección: no llama a Supabase, así que abrir el enlace no lo
// gasta.
export function loader({ request }: Route.LoaderArgs): {
  readonly tokenHash: string | null;
  /** La página pedida antes de entrar, si fue una en particular. */
  readonly returnPath: string | null;
  readonly signInPath: string;
} {
  const params = new URL(request.url).searchParams;
  const returnPath = readRequestedPage(params.get(RETURN_PARAM));
  return {
    tokenHash: readToken(params.get(TOKEN_PARAM)),
    returnPath,
    signInPath: buildSignInPathFor(returnPath, getRequestLanguage(request)),
  };
}

function refuse(
  status: SignInLinkOutcome["status"],
): ReturnType<typeof data<SignInLinkOutcome>> {
  const code =
    status === "unavailable" ? SERVICE_UNAVAILABLE_STATUS : BAD_REQUEST_STATUS;
  return data({ status }, { status: code });
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ReturnType<typeof data<SignInLinkOutcome>>> {
  const formData = await request.formData();
  const tokenHash = readToken(formData.get(TOKEN_PARAM));
  if (tokenHash === null) return refuse("invalid_link");
  const { client } = context.get(panelSessionContext);
  const result = await redeemSignInLink(client, tokenHash);
  if (result.status !== "signed_in") return refuse(result.status);
  const requested = readRequestedPage(formData.get(RETURN_PARAM));
  throw redirect(resolveSignedInPath(requested, result.language));
}

export default function SignInLink({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <SignInLinkScreen {...loaderData} outcome={actionData} />;
}
