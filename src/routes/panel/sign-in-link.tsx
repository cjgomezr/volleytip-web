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
  readReturnTarget,
  resolveReturnPath,
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

function readRequestedPage(request: Request): string | null {
  const url = new URL(request.url);
  return readReturnTarget(url.searchParams.get(RETURN_PARAM));
}

// Solo mira la dirección: no llama a Supabase, así que abrir el enlace no lo
// gasta.
export function loader({ request }: Route.LoaderArgs): {
  readonly tokenHash: string | null;
  readonly signInPath: string;
} {
  const language = getRequestLanguage(request);
  const requested = readRequestedPage(request);
  const returnPath =
    requested === null ? null : resolveReturnPath(requested, language);
  return {
    tokenHash: readToken(new URL(request.url).searchParams.get(TOKEN_PARAM)),
    signInPath: buildSignInPathFor(returnPath, language),
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
  const tokenHash = readToken((await request.formData()).get(TOKEN_PARAM));
  if (tokenHash === null) return refuse("invalid_link");
  const { client } = context.get(panelSessionContext);
  const result = await redeemSignInLink(client, tokenHash);
  if (result.status !== "signed_in") return refuse(result.status);
  throw redirect(
    resolveSignedInPath(readRequestedPage(request), result.language),
  );
}

export default function SignInLink({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
  return <SignInLinkScreen {...loaderData} outcome={actionData} />;
}
