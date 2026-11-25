import type { ReactElement } from "react";
import { Form, useNavigation } from "react-router";

import { Button } from "~/components/button";
import { FormProtection } from "~/components/form-protection";
import { TextField } from "~/components/text-field";
import type {
  SignInOutcome,
  SignInRejection,
} from "~/lib/forms/admin-sign-in-form.server";
import type { FormProtectionFields } from "~/lib/forms/protected-form.server";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

interface SignInFormProps {
  /** Lo que `issueFormProtection(ADMIN_SIGN_IN_FORM)` entregó en el `loader`. */
  readonly protection: FormProtectionFields;
  /** Lo que devolvió el `action`. */
  readonly outcome: SignInOutcome | undefined;
}

const REJECTION_MESSAGES: Record<SignInRejection, MessageKey> = {
  too_fast: "panel.signIn.rejected.tooFast",
  verification_failed: "panel.signIn.rejected.verification",
  rate_limited: "panel.signIn.rejected.rateLimited",
};

// El servidor devuelve claves de traducción como mensajes de error.
const ERROR_KEYS: readonly MessageKey[] = [
  "panel.signIn.error.email",
  "panel.signIn.error.emailTooLong",
];

function isErrorKey(message: string): message is MessageKey {
  return (ERROR_KEYS as readonly string[]).includes(message);
}

function findFailureMessage(
  outcome: SignInOutcome | undefined,
): MessageKey | undefined {
  if (outcome?.status === "rejected") return REJECTION_MESSAGES[outcome.reason];
  return outcome?.status === "unavailable"
    ? "panel.signIn.unavailable"
    : undefined;
}

function Confirmation(): ReactElement {
  const translate = useTranslate();
  return (
    <div className="mt-6 rounded-card bg-surface-light p-5">
      <p className="text-[18px] font-bold">
        {translate("panel.signIn.sent.title")}
      </p>
      <p className="mt-2 text-[15px] leading-[1.5] text-ink-subtle">
        {translate("panel.signIn.sent.details")}
      </p>
    </div>
  );
}

function EmailForm({ protection, outcome }: SignInFormProps): ReactElement {
  const translate = useTranslate();
  const navigation = useNavigation();
  const failure = findFailureMessage(outcome);
  const values =
    outcome?.status === "invalid" || outcome?.status === "unavailable"
      ? outcome.values
      : {};
  const emailError =
    outcome?.status === "invalid" ? outcome.fieldErrors.email : undefined;

  return (
    <Form method="post" noValidate className="mt-6 flex flex-col gap-4">
      {failure === undefined ? null : (
        <p role="alert" className="font-semibold text-brand-red-deep">
          {translate(failure)}
        </p>
      )}
      <TextField
        zone="light"
        label={translate("panel.signIn.emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        placeholder={translate("panel.signIn.emailPlaceholder")}
        isRequired
        defaultValue={values.email}
        error={
          emailError !== undefined && isErrorKey(emailError)
            ? translate(emailError)
            : emailError
        }
      />
      <FormProtection
        siteKey={protection.siteKey}
        timestamp={protection.timestamp}
      />
      <div className="flex flex-col">
        <Button
          type="submit"
          zone="light"
          submittingLabel={
            navigation.state === "idle"
              ? undefined
              : translate("panel.signIn.submitting")
          }
        >
          {translate("panel.signIn.submit")}
        </Button>
      </div>
      <p className="text-[13px] text-ink-subtle">
        {translate("panel.signIn.teamOnly")}
      </p>
    </Form>
  );
}

/**
 * El formulario que pide el enlace. Con un envío aceptado lo reemplaza el
 * aviso de revisar el correo, que vive en una región de estado para que un
 * lector de pantalla lo anuncie.
 */
export function SignInForm(props: SignInFormProps): ReactElement {
  const translate = useTranslate();
  const isSent = props.outcome?.status === "sent";
  return (
    <>
      <p className="mt-3 text-[16px] leading-[1.5] text-ink-subtle">
        {translate("panel.signIn.intro")}
      </p>
      {/* La región existe siempre: un lector de pantalla solo anuncia lo que
          cambia dentro de una región que ya estaba en la página. */}
      <div role="status">{isSent ? <Confirmation /> : null}</div>
      {isSent ? null : <EmailForm {...props} />}
    </>
  );
}
