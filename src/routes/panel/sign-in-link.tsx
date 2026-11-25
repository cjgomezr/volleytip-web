import type { ReactElement } from "react";
import { data, redirect } from "react-router";

import {
  SignInLinkScreen,
  type SignInLinkDetails,
  type SignInLinkOutcome,
} from "~/components/panel/sign-in-link-screen";
import { readFormData } from "~/lib/forms/protected-form.server";
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

// Lo mismo se lee de la dirección del correo y de los campos del envío.
function readLinkDetails(
  fields: { readonly get: (name: string) => unknown },
  request: Request,
): SignInLinkDetails {
  const returnPath = readRequestedPage(fields.get(RETURN_PARAM));
  return {
    tokenHash: readToken(fields.get(TOKEN_PARAM)),
    returnPath,
    signInPath: buildSignInPathFor(returnPath, getRequestLanguage(request)),
  };
}

// Solo mira la dirección: no llama a Supabase, así que abrir el enlace no lo
// gasta.
export function loader({ request }: Route.LoaderArgs): SignInLinkDetails {
  return readLinkDetails(new URL(request.url).searchParams, request);
}

function refuse(
  status: SignInLinkOutcome["status"],
  details: SignInLinkDetails,
): ReturnType<typeof data<SignInLinkOutcome>> {
  const code =
    status === "unavailable" ? SERVICE_UNAVAILABLE_STATUS : BAD_REQUEST_STATUS;
  return data({ status, ...details }, { status: code });
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ReturnType<typeof data<SignInLinkOutcome>>> {
  const details = readLinkDetails(await readFormData(request), request);
  if (details.tokenHash === null) return refuse("invalid_link", details);
  const { client } = context.get(panelSessionContext);
  const result = await redeemSignInLink(client, details.tokenHash);
  if (result.status !== "signed_in") return refuse(result.status, details);
  throw redirect(resolveSignedInPath(details.returnPath, result.language));
}

export default function SignInLink({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <SignInLinkScreen {...loaderData} outcome={actionData} />;
}
