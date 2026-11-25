import type { ReactElement } from "react";
import { Form, Link, useNavigation } from "react-router";

import { Button, getButtonLinkClassName } from "~/components/button";
import { useTranslate } from "~/lib/i18n/translations-context";

import { SignInLayout } from "./sign-in-layout";

/** Lo que devuelve el `action` cuando no deja entrar. */
export interface SignInLinkOutcome {
  readonly status: "invalid_link" | "unavailable";
}

interface SignInLinkScreenProps {
  /** El token que trae la dirección; `null` si no trae uno con forma válida. */
  readonly tokenHash: string | null;
  /** La pantalla de entrada, para pedir otro enlace. */
  readonly signInPath: string;
  readonly outcome: SignInLinkOutcome | undefined;
}

function DeadLink({
  signInPath,
}: {
  readonly signInPath: string;
}): ReactElement {
  const translate = useTranslate();
  return (
    <SignInLayout heading={translate("panel.signInLink.invalid.title")}>
      <p
        role="alert"
        className="mt-3 text-[16px] leading-[1.5] text-ink-subtle"
      >
        {translate("panel.signInLink.invalid.details")}
      </p>
      <div className="mt-6 flex flex-col">
        <Link
          to={signInPath}
          className={getButtonLinkClassName("primary", "light")}
        >
          {translate("panel.signInLink.invalid.action")}
        </Link>
      </div>
    </SignInLayout>
  );
}

/**
 * La página a la que lleva el correo. Cargarla no canjea nada: un lector de
 * correo que visita el enlace no lo gasta. Canjea el botón, que lo envía.
 */
export function SignInLinkScreen({
  tokenHash,
  signInPath,
  outcome,
}: SignInLinkScreenProps): ReactElement {
  const translate = useTranslate();
  const navigation = useNavigation();
  if (tokenHash === null || outcome?.status === "invalid_link") {
    return <DeadLink signInPath={signInPath} />;
  }
  return (
    <SignInLayout heading={translate("panel.signIn.heading")}>
      <p className="mt-3 text-[16px] leading-[1.5] text-ink-subtle">
        {translate("panel.signInLink.intro")}
      </p>
      <Form method="post" className="mt-6 flex flex-col gap-4">
        {outcome?.status === "unavailable" ? (
          <p role="alert" className="font-semibold text-brand-red-deep">
            {translate("panel.signInLink.unavailable")}
          </p>
        ) : null}
        <input type="hidden" name="token_hash" value={tokenHash} />
        <Button
          type="submit"
          zone="light"
          submittingLabel={
            navigation.state === "idle"
              ? undefined
              : translate("panel.signInLink.submitting")
          }
        >
          {translate("panel.signInLink.submit")}
        </Button>
      </Form>
    </SignInLayout>
  );
}
