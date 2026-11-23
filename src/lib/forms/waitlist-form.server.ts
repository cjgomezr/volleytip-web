import { data } from "react-router";
import { z } from "zod";

import { isCountryCode } from "../countries";
import { getRequestLanguage } from "../i18n/languages";
import { getCurrentLegalVersion } from "../legal/legal-documents";
import { joinWaitlist, type WaitlistKind } from "../waitlists.server";

import {
  defineProtectedForm,
  processProtectedForm,
  type ProtectedFormDependencies,
} from "./protected-form.server";

/**
 * El formulario de lista de espera (FR-082) y el `action` que lo recibe. Lo
 * usan la página de la app y, cuando exista, `/r/`: cada página lo conecta
 * con `handleWaitlistSubmission(request, kind)` y pinta `<WaitlistForm>`.
 */

// Largo máximo de una dirección de correo (RFC 5321).
const MAX_EMAIL_LENGTH = 254;
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const TOO_MANY_REQUESTS_STATUS = 429;

/** Los mensajes del esquema son claves de traducción: el formulario las pinta
 * en el idioma de la página. */
export const WAITLIST_ERROR_KEYS = {
  emailInvalid: "waitlist.error.email",
  emailTooLong: "waitlist.error.emailTooLong",
  countryInvalid: "waitlist.error.country",
} as const;

const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .max(MAX_EMAIL_LENGTH, WAITLIST_ERROR_KEYS.emailTooLong)
    .pipe(z.email(WAITLIST_ERROR_KEYS.emailInvalid)),
  country: z.string().refine(isCountryCode, WAITLIST_ERROR_KEYS.countryInvalid),
});

export const WAITLIST_FORM = defineProtectedForm({
  id: "app_waitlist",
  schema: waitlistSchema,
});

export type WaitlistRejection =
  "too_fast" | "verification_failed" | "rate_limited";

/** Lo que el `action` le devuelve a la página. */
export type WaitlistOutcome =
  | { readonly status: "joined" }
  | {
      readonly status: "invalid";
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | { readonly status: "rejected"; readonly reason: WaitlistRejection };

export interface WaitlistSubmissionDependencies {
  /** Para probar las capas sin Cloudflare ni base. */
  readonly protection?: Partial<ProtectedFormDependencies>;
  readonly join?: typeof joinWaitlist;
}

/**
 * Recibe un envío del formulario: pasa las capas de protección y, si las
 * pasa, inscribe el correo. Quien llena el campo trampa recibe la misma
 * confirmación que un envío real, para que un bot no sepa que fue visto.
 * Lanza si la base falla.
 */
export async function handleWaitlistSubmission(
  request: Request,
  kind: WaitlistKind,
  { protection = {}, join = joinWaitlist }: WaitlistSubmissionDependencies = {},
): Promise<ReturnType<typeof data<WaitlistOutcome>>> {
  const result = await processProtectedForm(request, WAITLIST_FORM, protection);
  switch (result.status) {
    case "discarded":
      return data({ status: "joined" }, { status: OK_STATUS });
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
    case "accepted":
      await join({
        kind,
        email: result.data.email,
        locale: getRequestLanguage(request),
        countryCode: result.data.country,
        city: null,
        privacyVersion: getCurrentLegalVersion("privacy"),
      });
      return data({ status: "joined" }, { status: OK_STATUS });
  }
}
