import { data } from "react-router";
import { z } from "zod";

import { isCountryCode } from "../countries";
import {
  findContactReason,
  resolveContactReason,
  type ContactReasonId,
} from "../contact-reasons";
import { getRequestLanguage } from "../i18n/languages";
import { getCurrentLegalVersion } from "../legal/legal-documents";
import { saveMessage } from "../messages.server";

import {
  defineProtectedForm,
  processProtectedForm,
  type ProtectedFormDependencies,
} from "./protected-form.server";

/**
 * El formulario de contacto (FR-053) y el `action` que lo recibe. El motivo
 * viaja en el campo `reason` con el mismo valor que lleva la dirección.
 */

const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const TOO_MANY_REQUESTS_STATUS = 429;

// Los topes de las columnas de `messages` (nombre y mensaje) y el largo
// máximo de una dirección de correo (RFC 5321).
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
export const MAX_MESSAGE_LENGTH = 2000;
// Sin tope en la base: el de estos dos campos propios del motivo es nuestro.
const MAX_EXTRA_FIELD_LENGTH = 120;

/** Los mensajes del esquema son claves de traducción: el formulario las pinta
 * en el idioma de la página. */
export const CONTACT_ERROR_KEYS = {
  nameRequired: "contact.error.nameRequired",
  nameTooLong: "contact.error.nameTooLong",
  emailInvalid: "contact.error.email",
  emailTooLong: "contact.error.emailTooLong",
  countryInvalid: "contact.error.country",
  messageRequired: "contact.error.messageRequired",
  messageTooLong: "contact.error.messageTooLong",
  orderNumberRequired: "contact.error.orderNumberRequired",
  brandRequired: "contact.error.brandRequired",
  extraFieldTooLong: "contact.error.extraFieldTooLong",
} as const;

const requiredText = (maxLength: number, tooLong: string): z.ZodString =>
  z.string().trim().max(maxLength, tooLong);

const contactFieldsSchema = z.object({
  reason: z.string().optional(),
  name: requiredText(MAX_NAME_LENGTH, CONTACT_ERROR_KEYS.nameTooLong).min(
    1,
    CONTACT_ERROR_KEYS.nameRequired,
  ),
  email: z
    .string()
    .trim()
    .max(MAX_EMAIL_LENGTH, CONTACT_ERROR_KEYS.emailTooLong)
    .pipe(z.email(CONTACT_ERROR_KEYS.emailInvalid)),
  country: z.string().refine(isCountryCode, CONTACT_ERROR_KEYS.countryInvalid),
  message: requiredText(
    MAX_MESSAGE_LENGTH,
    CONTACT_ERROR_KEYS.messageTooLong,
  ).min(1, CONTACT_ERROR_KEYS.messageRequired),
  orderNumber: requiredText(
    MAX_EXTRA_FIELD_LENGTH,
    CONTACT_ERROR_KEYS.extraFieldTooLong,
  ).optional(),
  brand: requiredText(
    MAX_EXTRA_FIELD_LENGTH,
    CONTACT_ERROR_KEYS.extraFieldTooLong,
  ).optional(),
});

/** Un mensaje de contacto ya validado, con solo lo que su motivo usa. */
export interface ContactData {
  readonly reason: ContactReasonId;
  readonly name: string;
  readonly email: string;
  readonly country: string;
  readonly message: string;
  readonly payload: Readonly<Record<string, string>>;
}

const REQUIRED_EXTRA_FIELD_ERRORS = {
  orderNumber: CONTACT_ERROR_KEYS.orderNumberRequired,
  brand: CONTACT_ERROR_KEYS.brandRequired,
} as const;

const contactSchema = contactFieldsSchema
  .superRefine((fields, context) => {
    const { extraField } = findContactReason(
      resolveContactReason(fields.reason),
    );
    if (extraField === undefined) return;
    if ((fields[extraField] ?? "") === "") {
      context.addIssue({
        code: "custom",
        path: [extraField],
        message: REQUIRED_EXTRA_FIELD_ERRORS[extraField],
      });
    }
  })
  .transform((fields): ContactData => {
    const reason = resolveContactReason(fields.reason);
    const { extraField } = findContactReason(reason);
    const extraValue =
      extraField === undefined ? undefined : fields[extraField];
    return {
      reason,
      name: fields.name,
      email: fields.email,
      country: fields.country,
      message: fields.message,
      payload:
        extraField === undefined || extraValue === undefined
          ? {}
          : { [extraField]: extraValue },
    };
  });

export const CONTACT_FORM = defineProtectedForm({
  id: "contact",
  schema: contactSchema,
});

export type ContactRejection =
  "too_fast" | "verification_failed" | "rate_limited";

/** Lo que el `action` le devuelve a la página. */
export type ContactOutcome =
  | { readonly status: "sent" }
  | {
      readonly status: "invalid";
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | { readonly status: "rejected"; readonly reason: ContactRejection };

export interface ContactSubmissionDependencies {
  /** Para probar las capas sin Cloudflare ni base. */
  readonly protection?: Partial<ProtectedFormDependencies>;
  readonly save?: typeof saveMessage;
}

/**
 * Recibe un envío del formulario: pasa las capas de protección y, si las
 * pasa, guarda el mensaje. Quien llena el campo trampa recibe la misma
 * confirmación que un envío real, para que un bot no sepa que fue visto.
 * Lanza si la base falla.
 */
export async function handleContactSubmission(
  request: Request,
  { protection = {}, save = saveMessage }: ContactSubmissionDependencies = {},
): Promise<ReturnType<typeof data<ContactOutcome>>> {
  const result = await processProtectedForm(request, CONTACT_FORM, protection);
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
    case "accepted":
      await save({
        reason: findContactReason(result.data.reason).storedReason,
        name: result.data.name,
        email: result.data.email,
        whatsapp: null,
        countryCode: result.data.country,
        body: result.data.message,
        payload: result.data.payload,
        locale: getRequestLanguage(request),
        privacyVersion: getCurrentLegalVersion("privacy"),
      });
      return data({ status: "sent" }, { status: OK_STATUS });
  }
}
