import type { ReactElement } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";

import { Button } from "~/components/button";
import { FormProtection } from "~/components/form-protection";
import { TextField } from "~/components/text-field";
import { SIGN_IN_ERROR_KEYS } from "~/lib/admin/sign-in-errors";
import type {
  SignInOutcome,
  SignInRejection,
} from "~/lib/forms/admin-sign-in-form.server";
import type { FormProtectionFields } from "~/lib/forms/protected-form.server";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import type { GoogleNotice } from "~/lib/panel/google-notice";
import { buildSignInPathFor, RETURN_PARAM } from "~/lib/panel/return-path";

import { GoogleSignIn } from "./google-sign-in";
import { UnsentNotice } from "./unsent-notice";

export interface SignInFormProps {
  /** Lo que `issueFormProtection(ADMIN_SIGN_IN_FORM)` entregó en el `loader`. */
  readonly protection: FormProtectionFields;
  /** Lo que devolvió el `action`. */
  readonly outcome: SignInOutcome | undefined;
  /** El envío no llegó al servidor. */
  readonly isUnsent?: boolean;
  /** El entorno tiene Google configurado. */
  readonly isGoogleEnabled?: boolean;
  /** Por qué Google no dejó entrar, si se viene de intentarlo. */
  readonly googleNotice?: GoogleNotice | null;
}

const REJECTION_MESSAGES: Record<SignInRejection, MessageKey> = {
  too_fast: "panel.signIn.rejected.tooFast",
  verification_failed: "panel.signIn.rejected.verification",
  rate_limited: "panel.signIn.rejected.rateLimited",
};

const GOOGLE_NOTICE_MESSAGES: Record<GoogleNotice, MessageKey> = {
  denied: "panel.signIn.google.denied",
  failed: "panel.signIn.google.failed",
};

// El servidor devuelve claves de traducción como mensajes de error.
const ERROR_KEYS: readonly MessageKey[] = Object.values(SIGN_IN_ERROR_KEYS);

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

// Vuelve a la entrada sin la respuesta del envío, para corregir el correo o
// pedir otro enlace. Conserva la página a la que se iba.
function UseAnotherEmail(): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const [params] = useSearchParams();
  return (
    <Link
      to={buildSignInPathFor(params.get(RETURN_PARAM), language)}
      className="mt-2 inline-flex min-h-[48px] items-center text-[15px] font-bold underline focused:outline-brand-night hovered:text-brand-red-deep"
    >
      {translate("panel.signIn.sent.another")}
    </Link>
  );
}

function EmailForm({
  protection,
  outcome,
  isUnsent,
}: SignInFormProps): ReactElement {
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
    <Form method="post" noValidate className="mt-6 flex flex-col gap-3.5">
      {isUnsent ? (
        <div>
          <UnsentNotice />
        </div>
      ) : null}
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
    </Form>
  );
}

// Las dos formas de entrar y a quién le sirven.
function EntryOptions(props: SignInFormProps): ReactElement {
  const translate = useTranslate();
  // Tras intentar con el correo, el aviso de Google ya no viene al caso.
  const notice = props.outcome === undefined ? props.googleNotice : null;
  return (
    <>
      {notice ? (
        <p role="alert" className="mt-4 font-semibold text-brand-red-deep">
          {translate(GOOGLE_NOTICE_MESSAGES[notice])}
        </p>
      ) : null}
      <EmailForm {...props} />
      {props.isGoogleEnabled ? <GoogleSignIn /> : null}
      <p className="mt-3.5 text-[13px] text-ink-subtle">
        {translate("panel.signIn.teamOnly")}
      </p>
    </>
  );
}

/**
 * El formulario que pide el enlace. Con un envío aceptado lo reemplaza la
 * explicación de que revise su correo, que vive en una región de estado para
 * que un lector de pantalla la anuncie. El título lo cambia la pantalla.
 */
export function SignInForm(props: SignInFormProps): ReactElement {
  const translate = useTranslate();
  const isSent = props.outcome?.status === "sent";
  return (
    <>
      {isSent ? null : (
        <p className="mt-2.5 text-[16px] leading-[1.5] text-ink-subtle">
          {translate("panel.signIn.intro")}
        </p>
      )}
      {/* La región existe siempre: un lector de pantalla solo anuncia lo que
          cambia dentro de una región que ya estaba en la página. */}
      <div role="status">
        {isSent ? (
          <p className="mt-2.5 text-[16px] leading-[1.5] text-ink-subtle">
            {translate("panel.signIn.sent.details")}
          </p>
        ) : null}
      </div>
      {isSent ? <UseAnotherEmail /> : <EntryOptions {...props} />}
    </>
  );
}
