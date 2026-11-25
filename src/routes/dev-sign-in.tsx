import type { ReactElement } from "react";
import { data } from "react-router";

import {
  SignInLinkScreen,
  type SignInLinkOutcome,
} from "~/components/panel/sign-in-link-screen";
import { serverEnv } from "~/lib/env.server";
import {
  ADMIN_SIGN_IN_FORM,
  SIGN_IN_ERROR_KEYS,
  type SignInOutcome,
} from "~/lib/forms/admin-sign-in-form.server";
import {
  issueFormProtection,
  type FormProtectionFields,
} from "~/lib/forms/protected-form.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";

import type { Route } from "./+types/dev-sign-in";
import { SignInScreen } from "./panel/sign-in";

// Pinta la entrada del panel y la página de su enlace en cada estado, sin la
// base ni correos, para capturarlas en Playwright:
// `?estado=vacio|error|enviado|enlace|vencido`. Solo pinta: no recibe envíos.
// En producción responde 404.
const NOT_FOUND_STATUS = 404;
const STATE_PARAM = "estado";
const SAMPLE_TOKEN = "token-de-muestra-que-no-abre-nada";

type Sample =
  | { readonly screen: "form"; readonly outcome: SignInOutcome | undefined }
  | {
      readonly screen: "link";
      readonly outcome: SignInLinkOutcome | undefined;
    };

const SAMPLES: Readonly<Record<string, Sample>> = {
  vacio: { screen: "form", outcome: undefined },
  error: {
    screen: "form",
    outcome: {
      status: "invalid",
      fieldErrors: { email: SIGN_IN_ERROR_KEYS.emailInvalid },
      values: { email: "andres@" },
    },
  },
  enviado: { screen: "form", outcome: { status: "sent" } },
  enlace: { screen: "link", outcome: undefined },
  vencido: { screen: "link", outcome: { status: "invalid_link" } },
};

export function loader({ request }: Route.LoaderArgs): Sample & {
  readonly protection: FormProtectionFields;
  readonly signInPath: string;
} {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const state = new URL(request.url).searchParams.get(STATE_PARAM) ?? "vacio";
  const sample = SAMPLES[state];
  if (sample === undefined) throw data(null, { status: NOT_FOUND_STATUS });
  return {
    ...sample,
    protection: issueFormProtection(ADMIN_SIGN_IN_FORM),
    signInPath: getPanelPath("adminSignIn", getRequestLanguage(request)),
  };
}

export default function DevSignIn({
  loaderData,
}: Route.ComponentProps): ReactElement {
  if (loaderData.screen === "form") {
    return (
      <SignInScreen
        protection={loaderData.protection}
        outcome={loaderData.outcome}
      />
    );
  }
  return (
    <SignInLinkScreen
      tokenHash={SAMPLE_TOKEN}
      signInPath={loaderData.signInPath}
      outcome={loaderData.outcome}
    />
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex" }];
}
