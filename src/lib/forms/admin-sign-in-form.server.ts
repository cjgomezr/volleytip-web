import { data } from "react-router";
import { z } from "zod";

import { serverEnv } from "../env.server";
import { getRequestLanguage } from "../i18n/languages";
import {
  requestSignInLink,
  type SignInLinkOptions,
} from "../panel/sign-in-link.server";
import { resolveReturnPath, RETURN_PARAM } from "../panel/return-path";

import {
  defineProtectedForm,
  processProtectedForm,
  type ProtectedFormDependencies,
} from "./protected-form.server";

/** El formulario de entrada al panel (FR-058) y el `action` que lo recibe. */

const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const TOO_MANY_REQUESTS_STATUS = 429;
const SERVICE_UNAVAILABLE_STATUS = 503;

// El largo máximo de una dirección de correo (RFC 5321).
const MAX_EMAIL_LENGTH = 254;
const TEN_MINUTES_IN_SECONDS = 600;
const MAX_LINK_REQUESTS = 5;

/** Los mensajes del esquema son claves de traducción: el formulario las pinta
 * en el idioma de la página. */
export const SIGN_IN_ERROR_KEYS = {
  emailInvalid: "panel.signIn.error.email",
  emailTooLong: "panel.signIn.error.emailTooLong",
} as const;

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(MAX_EMAIL_LENGTH, SIGN_IN_ERROR_KEYS.emailTooLong)
    .pipe(z.email(SIGN_IN_ERROR_KEYS.emailInvalid)),
});

/** Su límite por IP es propio: lo cuenta aparte de los formularios del sitio. */
export const ADMIN_SIGN_IN_FORM = defineProtectedForm({
  id: "admin_sign_in",
  schema: signInSchema,
  rateLimit: {
    maxAttempts: MAX_LINK_REQUESTS,
    windowSeconds: TEN_MINUTES_IN_SECONDS,
    mode: "block",
  },
});

export type SignInRejection =
  "too_fast" | "verification_failed" | "rate_limited";

/** Lo que el `action` le devuelve a la pantalla. */
export type SignInOutcome =
  | { readonly status: "sent" }
  | {
      readonly status: "invalid";
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | { readonly status: "rejected"; readonly reason: SignInRejection }
  | {
      readonly status: "unavailable";
      readonly values: Readonly<Record<string, string>>;
    };

export interface SignInDependencies extends SignInLinkOptions {
  /** Para probar las capas sin Cloudflare ni base. */
  readonly protection?: Partial<ProtectedFormDependencies>;
}

// La dirección de regreso llega en la de la pantalla de entrada. Sin ella no
// se manda ninguna, y al entrar se va al inicio del panel.
function buildReturnUrl(
  request: Request,
  siteOrigin: string,
): string | undefined {
  const requested = new URL(request.url).searchParams.get(RETURN_PARAM);
  if (requested === null) return undefined;
  const path = resolveReturnPath(requested, getRequestLanguage(request));
  return new URL(path, siteOrigin).href;
}

/**
 * Recibe un envío del formulario: pasa las capas de protección y, si las
 * pasa, pide el enlace. Quien llena el campo trampa recibe la misma
 * confirmación que un envío real. Lanza si la base falla.
 */
export async function handleSignInRequest(
  request: Request,
  { protection = {}, ...linkOptions }: SignInDependencies = {},
): Promise<ReturnType<typeof data<SignInOutcome>>> {
  const result = await processProtectedForm(
    request,
    ADMIN_SIGN_IN_FORM,
    protection,
  );
  switch (result.status) {
    case "discarded":
      return data({ status: "sent" }, { status: OK_STATUS });
    case "too_fast":
    case "verification_failed":
      return data(
        { status: "rejected", reason: result.status },
        { status: BAD_REQUEST_STATUS },
      );
    case "rate_limited":
      return data(
        { status: "rejected", reason: result.status },
        { status: TOO_MANY_REQUESTS_STATUS },
      );
    case "invalid":
      return data(
        {
          status: "invalid",
          fieldErrors: result.fieldErrors,
          values: result.values,
        },
        { status: BAD_REQUEST_STATUS },
      );
    case "accepted": {
      const { email } = result.data;
      const { siteOrigin } = linkOptions.env ?? serverEnv;
      const returnUrl = buildReturnUrl(request, siteOrigin);
      const sending = await requestSignInLink(
        { email, returnUrl },
        linkOptions,
      );
      return sending === "sent"
        ? data({ status: "sent" }, { status: OK_STATUS })
        : data(
            { status: "unavailable", values: { email } },
            { status: SERVICE_UNAVAILABLE_STATUS },
          );
    }
  }
}
